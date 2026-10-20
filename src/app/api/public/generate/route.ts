import { NextResponse } from "next/server";
import { attachBuildClaimCookie } from "@/lib/build/claim-cookie";
import { generateFromAnswers, generateFromWebsite } from "@/lib/build/generate";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

type Body =
  | { mode: "website"; website: string }
  | { mode: "answers"; name: string; serviceIds: string[]; zips?: string; alertEmail?: string };

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!(await rateLimit(`build:generate:${ip}`, 10, 3600))) {
    return NextResponse.json({ error: "Too many builds from this network. Try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result =
    body.mode === "answers"
      ? await generateFromAnswers({
          name: body.name ?? "",
          serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [],
          zips: body.zips,
          alertEmail: body.alertEmail,
        })
      : await generateFromWebsite({ website: typeof body.website === "string" ? body.website : "" });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, needsQuestions: result.needsQuestions ?? false },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ slug: result.slug, name: result.name, path: `/p/${result.slug}` });
  attachBuildClaimCookie(res, result.claimToken);
  return res;
}

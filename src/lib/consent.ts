/** The exact SMS consent wording shown next to the (unticked) checkbox and stored with each lead. */
export function smsConsentText(businessName: string): string {
  return `I agree to receive text messages from ${businessName} about my quote and booking. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.`;
}

/** Legacy GTM event contract. */
export interface AnalyticsEvent {
  action: string;
  event: string;
  data: Record<string, string | undefined>;
  ecommerce?: Record<string, string | undefined>;
}

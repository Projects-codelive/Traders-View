interface TradingViewWidgetOptions {
  container_id: string;
  symbol: string;
  interval?: string;
  timezone?: string;
  theme?: "light" | "dark";
  style?: string;
  locale?: string;
  toolbar_bg?: string;
  enable_publishing?: boolean;
  hide_top_toolbar?: boolean;
  hide_legend?: boolean;
  hide_side_toolbar?: boolean;
  allow_symbol_change?: boolean;
  withdateranges?: boolean;
  save_image?: boolean;
  calendar?: boolean;
  hide_volume?: boolean;
  autosize?: boolean;
  studies?: string[];
  support_host?: string;
  [key: string]: unknown;
}

interface Window {
  TradingView: {
    widget: new (options: TradingViewWidgetOptions) => unknown;
  };
}

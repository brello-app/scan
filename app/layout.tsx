import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "@/styles/globals.css";
import { cn } from "@/lib/utils";
import { GlobalHeader } from "@/components/layout/header";
import { GlobalFooter } from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "AI Cost Analyzer for OpenAI and Anthropic";
const siteDescription =
  "Analyze OpenAI and Anthropic usage or cost CSVs to spot unusual AI spending and usage spikes. Your file is processed in your browser.";

export const metadata: Metadata = {
  title: {
    default: "Find Leaks in Your AI Bill | Brello Scan",
    template: "%s | Brello Scan",
  },
  description: siteDescription,
  applicationName: "Brello Scan",
  keywords: [
    "AI cost analyzer",
    "OpenAI usage report",
    "Anthropic usage report",
    "AI spending",
    "API cost analysis",
  ],
  openGraph: {
    type: "website",
    siteName: "Brello",
    title: siteTitle,
    description: siteDescription,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <GlobalHeader />
        {children}
        <GlobalFooter />
      </body>
    </html>
  );
}

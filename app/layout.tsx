import "./globals.css";

export const metadata = {
  title: "Market Benchmark Tool",
  description: "Benchmark compensation against market data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
export const metadata = {
  title: "WarRoom Ops",
  description: "WarRoom Ops web app",
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

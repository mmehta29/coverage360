import './globals.css'

export const metadata = {
  title: 'Coverage360 · Analyst Portal',
  description: 'Medical benefit drug coverage intelligence',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
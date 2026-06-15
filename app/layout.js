import './globals.css';

export const metadata = {
  title: 'Quiniela Mundial 2026',
  description: 'Quiniela del Mundial 2026 para jugar con amigos, sin registro.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

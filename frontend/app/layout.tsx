import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import '../styles/html-content.css';

export const metadata = {
  title: 'Brahma',
  description: 'JWT Auth + Role Based App',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

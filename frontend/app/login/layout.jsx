import { AuthProvider } from '../../context/AuthContext';

export default function LoginLayout({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

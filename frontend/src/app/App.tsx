import { BrowserRouter, Routes, Route } from "react-router";
import { AuthProvider } from "./lib/auth";
import { UserPortal } from "./user/UserPortal";
import { AdminApp } from "./admin/AdminApp";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/*" element={<UserPortal />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

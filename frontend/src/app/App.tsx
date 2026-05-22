import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { WEDDING_SLUG } from "./api/config";
import { AuthProvider } from "./lib/auth";
import { WeddingApp } from "./user/WeddingApp";
import { AdminApp } from "./admin/AdminApp";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="/w/:slug/*" element={<WeddingApp />} />
          {/* Root and unknown paths fall back to the default wedding. */}
          <Route
            path="*"
            element={<Navigate to={`/w/${WEDDING_SLUG}`} replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

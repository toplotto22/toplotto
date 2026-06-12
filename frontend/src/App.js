import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "@/lib/context";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Sales from "@/pages/Sales";
import Tickets from "@/pages/Tickets";
import Results from "@/pages/Results";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import Verify from "@/pages/Verify";

const Protected = ({ children }) => {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <div className="dark">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="sales" element={<Sales />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="verify" element={<Verify />} />
            <Route path="results" element={<Results />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

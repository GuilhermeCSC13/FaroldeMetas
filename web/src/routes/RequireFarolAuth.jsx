// src/routes/RequireFarolAuth.jsx
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

const FAROL_URL = "https://faroldemetas.onrender.com";
const INOVE_LOGIN = "https://inovequatai.onrender.com/login";

function hasFromInove() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("from") === "inove";
  } catch {
    return false;
  }
}

function hasSessionFlag() {
  return sessionStorage.getItem("farol_ok") === "1";
}

export default function RequireFarolAuth() {
  const location = useLocation();

  useEffect(() => {
    if (hasFromInove()) {
      sessionStorage.setItem("farol_ok", "1");
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("from");
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {}
      return;
    }

    if (hasSessionFlag()) return;

    const returnTo = `${FAROL_URL}${location.pathname}${location.search || ""}`;
    const redirect = encodeURIComponent(returnTo);
    window.location.replace(`${INOVE_LOGIN}?redirect=${redirect}`);
  }, [location.pathname, location.search]);

  return <Outlet />;
}

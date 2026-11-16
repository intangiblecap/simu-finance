document.getElementById("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector("button");
  const err = document.getElementById("err");
  btn.disabled = true;
  err.hidden = true;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.password.value }),
    });
    if (res.ok) {
      location.replace("/");
      return;
    }
    const data = await res.json().catch(() => ({}));
    err.textContent = data.error || "Connexion impossible";
    err.hidden = false;
  } catch {
    err.textContent = "Connexion impossible (réseau)";
    err.hidden = false;
  }
  btn.disabled = false;
});

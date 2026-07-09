import { Request, Response } from "express";

export const redirectInvite = async (req: Request, res: Response) => {
const token = String(req.params.token || "").trim();
if (!token) return res.status(404).send("Invite invalide");

// ✅ On essaye d’ouvrir l’app si installée, sinon on affiche une page simple
const deepLink = `vocoshop://invite?token=${encodeURIComponent(token)}`;

const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="font-family:system-ui;background:#0A0617;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="max-width:520px;padding:18px;text-align:center">
<h2 style="margin:0 0 10px 0">Invitation Vocoshop</h2>
<p style="opacity:.8;margin:0 0 14px 0">Ouverture de l’application…</p>
<a href="${deepLink}" style="display:inline-block;padding:12px 14px;border-radius:12px;background:#8A4DFF;color:#fff;text-decoration:none;font-weight:800">
Ouvrir l’app
</a>
<p style="opacity:.6;margin:14px 0 0 0;font-size:12px">Si rien ne se passe, installe l’app puis ré-ouvre ce lien.</p>
<script>window.location.href="${deepLink}";</script>
</div>
</body></html>`;

res.setHeader("Content-Type", "text/html; charset=utf-8");
return res.status(200).send(html);
};

export function presentation(env: Record<string, unknown>) {
  const publicBrand = env.VITE_PUBLIC_PRESENTATION === "production";
  const configuredOrigin = env.VITE_PUBLIC_ORIGIN;
  if (configuredOrigin && (!publicBrand || configuredOrigin !== "https://thirddowntech.com")) {
    throw new Error("Public SEO origin requires production presentation and https://thirddowntech.com");
  }
  return { publicBrand, origin: configuredOrigin === "https://thirddowntech.com" ? configuredOrigin : undefined };
}

export function publicCopy(publicText: string, previewText: string): string {
  return presentation(import.meta.env).publicBrand ? publicText : previewText;
}

export function presentationHtml(html: string, env: Record<string, unknown>): string {
  const config = presentation(env);
  if (!config.publicBrand) return html;
  return html
    .replace('    <meta name="robots" content="noindex, nofollow" />\n', "")
    .replace("Development preview: practical engineering", "Practical engineering")
    .replace("Third Down Technologies | Development preview", "Third Down Technologies | Rethink. Create. Transform.")
    .replace("</head>", `${config.origin ? `  <link rel="canonical" href="${config.origin}/" />\n  ` : ""}</head>`);
}

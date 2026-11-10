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
    .replace("</head>", `${config.origin ? `  <link rel="canonical" href="${config.origin}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Third Down Technologies" />
    <meta property="og:title" content="Third Down Technologies | Rethink. Create. Transform." />
    <meta property="og:description" content="Practical engineering, digital foundations and technology leadership for small businesses and enterprise teams. Intake closed." />
    <meta property="og:url" content="${config.origin}/" />
    <meta property="og:image" content="${config.origin}/assets/third-down-social-8e2cf34fa2ac.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Third Down Technologies. Rethink. Create. Transform. A strategic playbook connecting technology and the next move." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Third Down Technologies | Rethink. Create. Transform." />
    <meta name="twitter:description" content="Practical engineering, digital foundations and technology leadership for small businesses and enterprise teams. Intake closed." />
    <meta name="twitter:image" content="${config.origin}/assets/third-down-social-8e2cf34fa2ac.jpg" />
    <meta name="twitter:image:alt" content="Third Down Technologies. Rethink. Create. Transform. A strategic playbook connecting technology and the next move." />
  ` : ""}</head>`);
}

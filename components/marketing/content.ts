/** Static marketing copy. Plain data — no CMS, no database. */

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Analytics", href: "#analytics" },
  { label: "QR codes", href: "#qr-codes" },
  { label: "FAQ", href: "#faq" },
] as const;

export const benefits = [
  {
    title: "Clean links",
    body: "Turn a long, messy URL into something short enough to say out loud, print, or drop in a bio.",
  },
  {
    title: "Link control",
    body: "Change where a short link goes without changing the link itself. Pause or expire it when you're done.",
  },
  {
    title: "Useful insight",
    body: "See clicks over time and where they come from: country, device, browser and referrer.",
  },
  {
    title: "QR ready",
    body: "Every short link can become a QR code, ready to download and share.",
  },
  {
    title: "Built for real sharing",
    body: "For creators, businesses, events, and anyone who sends links more than once.",
  },
] as const;

export const useCases = [
  {
    title: "Creators",
    body: "Share cleaner links across social platforms and bios.",
    example: "vurlo.link/new-video",
  },
  {
    title: "Freelancers",
    body: "Send portfolio and project links that look considered.",
    example: "vurlo.link/portfolio",
  },
  {
    title: "Small businesses",
    body: "Use short links in flyers, packaging, and campaigns.",
    example: "vurlo.link/menu",
  },
  {
    title: "Event organizers",
    body: "Put a short link and QR code on every poster.",
    example: "vurlo.link/rsvp",
  },
  {
    title: "Marketers",
    body: "Tag campaign links with UTM parameters and track the traffic.",
    example: "vurlo.link/spring",
  },
  {
    title: "Developers",
    body: "Share compact URLs for docs, repos, and issue threads.",
    example: "vurlo.link/api-docs",
  },
] as const;

export const trustPoints = [
  {
    title: "Account ownership",
    body: "Links you create in an account belong to you. Only you can edit, pause, or delete them.",
  },
  {
    title: "Secure link management",
    body: "Managing links requires signing in, and your links are kept separate from everyone else's.",
  },
  {
    title: "Privacy-conscious analytics",
    body: "Analytics show aggregate click data, like country and device. They aren't a profile of any one visitor.",
  },
  {
    title: "Abuse controls",
    body: "Limits and reporting help keep short links from being used to cause harm.",
  },
  {
    title: "Protected data",
    body: "Your account and link data is stored with access controls, not left open.",
  },
] as const;

export const faqs = [
  {
    question: "What is Vurlo?",
    answer:
      "Vurlo turns long URLs into short links and helps you manage them. You can choose a custom alias, set an expiry, create a QR code, and see how many people clicked.",
  },
  {
    question: "Do I need an account?",
    answer:
      "You can create a short link without one. An account lets you keep your links in one place, edit them, and see analytics.",
  },
  {
    question: "Can I customize my short URL?",
    answer:
      "Yes. Pick your own alias, such as vurlo.link/summer, as long as it isn't already taken.",
  },
  {
    question: "Can I change where a short link goes?",
    answer:
      "Not yet. Editing destinations arrives with accounts, and the short URL will stay the same when it does.",
  },
  {
    question: "Do short links expire?",
    answer:
      "Yes. A link made without an account expires within 30 days. When you create one, choose 24 hours, 7 days or 30 days.",
  },
  {
    question: "What happens when a link expires?",
    answer:
      "Visitors see a message that the link has expired instead of being sent to the destination.",
  },
  {
    question: "Can I generate a QR code?",
    answer:
      "Yes. Any short link can be turned into a QR code you can download as PNG or SVG.",
  },
  {
    question: "Can I see how many people clicked?",
    answer:
      "Yes. Your dashboard shows total clicks over time, plus country, device, browser, operating system and referrer.",
  },
] as const;

export const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Analytics", href: "#analytics" },
      { label: "QR codes", href: "#qr-codes" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Legal",
    // href: null renders as "coming soon" text until the pages exist.
    links: [
      { label: "Privacy", href: null },
      { label: "Terms", href: null },
    ],
  },
] as const;

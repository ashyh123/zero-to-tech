export const site = {
  author: "Evan Huang",
  name: "一个零基础agent学生的旅程",
  description:
    "记录从零学习 Agent 的过程、踩坑与项目实践。写给正在走同一条路的你。",
  github: "https://github.com/ashyh123",
  x: "https://x.com/asomer666",
  repository: "https://github.com/ashyh123/zero-to-tech",
  email: "ashyh666@gmail.com",
};
export const friendLinks = [
  {
    name: "Joye Blog",
    url: "https://www.joyehuang.me/",
    avatar: "/images/friends/joye.webp",
  },
];
export const siteUrl = (
  process.env.SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// RSS is opt-in for release builds; local previews do not expose a feed.
export const rssEnabled = process.env.RSS_ENABLED === "true";

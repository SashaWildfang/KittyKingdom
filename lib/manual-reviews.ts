// Reviews from the Kitty Kingdom DISBOARD page. DISBOARD sits behind Cloudflare's bot check, so the
// site can't fetch them live; these are the fallback when the staff-managed `reviews` collection is empty.
// Staff can add new ones from Discord with /sitereviews add.
export type Review = {
  title?: string;
  author: string;
  text: string;
  rating: number;
  postedAt: string; // ISO date
};

export const manualReviews: Review[] = [
  {
    title: "Welcoming",
    author: "phoenix239905",
    postedAt: "2026-07-29",
    rating: 5,
    text: "Very welcoming community of all types of misfits. Making friends? Or trying to find love? Or even gambling? This server has it. Heavily recommended and I’d love to see ya soon!",
  },
  {
    title: "Fire place",
    author: "cbrn_shade",
    postedAt: "2026-07-24",
    rating: 5,
    text: "Nice people and floofs, makes me wanna tickle them all. They all deserve some lovins and a chance to know them all.",
  },
  {
    title: "Chill vibes, good people",
    author: "belial69420",
    postedAt: "2026-05-17",
    rating: 5,
    text: "Been kicking around for awhile, and thus far the people are fun and the admin team is actually engaged. Good vibes all around!",
  },
  {
    title: "Good server",
    author: "zoroarkconnoisseur",
    postedAt: "2026-05-17",
    rating: 5,
    text: "Very fun and inclusive. And the bots are very well set up! Highly recommend if you are looking for your forever partner or just trying to find friends",
  },
  {
    title: "Welcoming Atmosphere! Amazin Owner! Silly Friends!",
    author: "salttothebeanz",
    postedAt: "2026-05-11",
    rating: 5,
    text: "I absolutely adore this server! It can be a bit wild and crazy but that's part of the fun. People are very welcoming and make sure you feel right at home. The owner takes concerns seriously, and makes sure you're heard when it comes to any issues. This is one of the few servers im willing to be active in, its always changing for the better and more fun things are being added frequently. Definitely give it a go if you're looking for new friends and a chill place to be!",
  },
  {
    title: "The letters L-O-V-E",
    author: "clockwork405",
    postedAt: "2026-05-11",
    rating: 5,
    text: "This server has been honestly one of my favorite servers to be a part of, very accepting of everything and overall a great experience being a part of this community. Would recommend to furry and non furry users alike.",
  },
  {
    title: "Good site good people.",
    author: "beatricef0x",
    postedAt: "2026-05-11",
    rating: 5,
    text: "Very kind group, very dedicated mods and admins. Fun to talk in this server or post pics and art.",
  },
  {
    title: "The owner cares",
    author: "gamerxone",
    postedAt: "2026-05-11",
    rating: 5,
    text: "the owner seems to put a lot of effort into the server making it a friendly/engaging place to be",
  },
  {
    title: "Solid server 10/10",
    author: "slshrsh",
    postedAt: "2026-05-11",
    rating: 5,
    text: "Takes user safety seriously, has a great matchmaker bot/data base and also has a great in server economy/banking system. Would definitely recommend if you're looking for something different.",
  },
  {
    title: "Best dating server",
    author: "keiko_panda",
    postedAt: "2026-05-11",
    rating: 5,
    text: "Best dating server with very very friendly staff and members, everyone is always so nice and welcoming",
  },
  {
    title: "Very awsome",
    author: "aluta07",
    postedAt: "2026-05-11",
    rating: 5,
    text: "This one of my favorite servers, and probably one of the most active im in. This server needs more love.",
  },
  {
    title: "Best server for furry interaction",
    author: "notforyou.",
    postedAt: "2026-04-24",
    rating: 5,
    text: "This is one of THE BEST servers that as much inclusitivity as well as fun engagement and a very fun community that I 1000000% recommend joining, or my name isn't Gerson Boom from the hit game Deltarune Chapter4",
  },
];

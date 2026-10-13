/**
 * Which import-duty category an item belongs to, from its name and category text. The duty rate, and so the price, depends on it,
 * so an item can also be set by hand in the admin. Anything not recognised is "unknown": the pricing configuration charges it at its
 * highest planning rate and flags the order for staff to check.
 *
 * The ids are those of the pricing configuration's `categories`.
 */
const RULES: [id: string, test: RegExp][] = [
  ["phones_tablets", /\b(smart ?phones?|i ?phone|galaxy (s|a|z)\d|pixel \d|mobile phone|tablet|i ?pad)\b/i],
  ["laptops_computers", /\b(laptop|macbook|chromebook|notebook pc|desktop (pc|computer)|all-in-one pc|mini pc)\b/i],
  ["cameras_photo", /\b(camera|gopro|dslr|mirrorless|camcorder|tripod|selfie stick|drone|camera lens)\b/i],
  ["audio_wearables", /\b(head ?phones?|ear ?buds?|ear ?phones?|airpods?|bluetooth (speaker|headset)|speaker|smart ?watch|fitness (tracker|band)|power ?bank|wireless charger|soundbar)\b/i],
  ["computer_accessories", /\b(keyboard|mouse|web ?cam|monitor|usb ?hub|hard drive|ssd|router|printer|mouse ?pad|memory card|sd card|usb (stick|drive)|charging cable|hdmi|laptop stand)\b/i],
  ["footwear", /\b(shoes?|trainers?|sneakers?|boots?|sandals?|slippers?|heels|loafers?|flip.?flops?|footwear|wellies|plimsolls?)\b/i],
  ["clothing_apparel", /\b(t-?shirts?|shirts?|tees?|jackets?|coats?|jeans|trousers|dress(es)?|hoodies?|jumpers?|sweaters?|sweatshirts?|skirts?|shorts|tops?|leggings|underwear|socks|pyjamas?|clothing|apparel|fleece|gilet|cardigan|joggers|tracksuit|swimwear|bra)\b/i],
  ["bags_luggage", /\b(bags?|backpacks?|rucksacks?|suitcases?|luggage|handbags?|wallets?|purses?|holdall|duffel)\b/i],
  ["watches_jewellery", /\b(watch(es)?|jewel(l)?ery|necklaces?|bracelets?|rings?|earrings?|pendant)\b/i],
  ["beauty_personal_care", /\b(perfume|fragrance|cream|lotion|shampoo|conditioner|make-?up|lipstick|serum|skin ?care|moisturi[sz]er|hair (dryer|straightener)|shaver|trimmer|beauty|cosmetics?|deodorant|toothbrush)\b/i],
  ["health_devices", /\b(blood pressure|thermometer|pulse oximeter|massag\w*)\b/i],
  ["health_devices", /\b(TENS|EMS)\b/], // capitals only, so the word "tens" is safe
  ["baby_kids_toys", /\b(baby|toys?|lego|dolls?|kids?|child(ren)?|nappy|nappies|pushchair|stroller|puzzles?|board game|teddy|playset)\b/i],
  ["pets", /\b(pets?|dogs?|cats?|puppy|kitten|leash|dog collar|cat litter)\b/i],
  ["auto_accessories", /\b(car (seat|mat|cover|charger|vacuum)|tyres?|tire inflator|inflator|dash ?cam|windscreen|wipers?|jump starter|motor oil|sat nav)\b/i],
  ["sports_outdoor", /\b(football|rugby|golf|tennis|badminton|cycling|bike|bicycle|running|yoga|dumbbells?|kettlebell|gym|fitness|tent|camping|sleeping bag|hiking|swim|sports?|outdoor|fishing|skateboard)\b/i],
  ["books_stationery", /\b(books?|novels?|notebooks?|stationery|pens?|pencils?|journals?|diary|planner|textbook|paperback|hardback)\b/i],
  // generic household and hardware goods share the 20% band with kitchen and home
  ["kitchen_home", /\b(kettle|air ?fryer|blender|toaster|cookware|frying pan|saucepan|knife|cutlery|bedding|duvet|pillow|towels?|lamp|curtains?|storage|containers?|vacuum|iron|kitchen|home|furniture|rugs?|mugs?|cups?|bottles?|mop|tools?|drill|measure|screwdriver|garden|lights?|candles?|clocks?|fans?|heaters?)\b/i],
];

export function inferDutyCategory(...text: (string | null | undefined)[]): string {
  const s = text.filter(Boolean).join(" ");
  for (const [id, re] of RULES) if (re.test(s)) return id;
  return "unknown";
}

/** The duty category for the "kind of item" a customer picks on a link request. */
export function dutyCategoryForItemType(itemType: string): string {
  switch (itemType.trim().toLowerCase()) {
    case "clothing": return "clothing_apparel";
    case "shoes and boots": return "footwear";
    case "beauty and health": return "beauty_personal_care";
    case "small electronics": return "audio_wearables";
    case "home and kitchen": return "kitchen_home";
    case "toys and baby": return "baby_kids_toys";
    case "books": return "books_stationery";
    case "sports and outdoors": return "sports_outdoor";
    default: return "unknown";
  }
}

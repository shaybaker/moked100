// Game content: places on the map, units, game modes and the calls.
// Adding a scene = one video in src/assets/video, a few audio lines in
// tools/make_audio.py and one entry in SCENES.

export const PLACES = {
  neighborhood: { id: "neighborhood", name: "שכונת הגפן",     sub: "רחוב הגפן 12",        icon: "🏘️", x: 160, y: 130 },
  hotel:        { id: "hotel",        name: "מלון העיר",      sub: "רחוב הים 3",          icon: "🏨", x: 315, y: 120 },
  mall:         { id: "mall",         name: "קניון השוק",     sub: "מרכז מסחרי",          icon: "🏬", x: 470, y: 110 },
  highway:      { id: "highway",      name: "הכביש המהיר",    sub: "כביש 4, מחלף צפון",   icon: "🛣️", x: 625, y: 120 },
  parking:      { id: "parking",      name: "החניון המרכזי",  sub: "חניון ציבורי",        icon: "🅿️", x: 780, y: 130 },
  downtown:     { id: "downtown",     name: "רחוב הרצל",      sub: "מרכז העיר",           icon: "🏙️", x: 160, y: 330 },
  junction:     { id: "junction",     name: "צומת העצמאות",   sub: "צומת מרומזר",         icon: "🚦", x: 470, y: 320 },
  park:         { id: "park",         name: "פארק העיר",      sub: "שער ראשי והחורשה",    icon: "🌳", x: 780, y: 330 },
  train:        { id: "train",        name: "תחנת הרכבת",     sub: "רציף 2",              icon: "🚉", x: 110, y: 455 },
  garden:       { id: "garden",       name: "גינת הפרחים",    sub: "גינה ציבורית",        icon: "🌷", x: 300, y: 450 },
  busstop:      { id: "busstop",      name: "התחנה המרכזית",  sub: "תחנת אוטובוס",        icon: "🚏", x: 480, y: 455 },
  industrial:   { id: "industrial",   name: "אזור התעשייה",   sub: "מחסני עצים",          icon: "🏭", x: 860, y: 455 },
};

export const STATION = { x: 640, y: 480, name: "תחנת משטרה", icon: "🏢" };

// 100 = police, 101 = Magen David Adom, 102 = fire and rescue. The dispatcher
// at 100 calls the other services in when needed, so they are units too.
export const UNITS = {
  patrol:    { id: "patrol",    code: "ניידת 21",     name: "ניידת סיור",     icon: "🚓", desc: "פריצות, גניבות, חשודים" },
  moto:      { id: "moto",      code: "אופנוע 7",     name: "אופנוע משטרה",   icon: "🏍️", desc: "מרדף אחרי מי שברח" },
  traffic:   { id: "traffic",   code: "תנועה 4",      name: "ניידת תנועה",    icon: "🚔", desc: "כבישים, צמתים, נהגים" },
  community: { id: "community", code: "קהילתי 12",    name: "שוטר קהילתי",    icon: "👮", desc: "ילדים, קשישים, בעלי חיים" },
  k9:        { id: "k9",        code: "כלבן 9",       name: "יחידת הכלבנים",  icon: "🐕‍🦺", desc: "חיפוש נעדרים ואיתור חשודים" },
  fire:      { id: "fire",      code: "כבאית 102",    name: "כבאות והצלה",    icon: "🚒", desc: "שריפות וחילוץ מרכב" },
  ambulance: { id: "ambulance", code: "אמבולנס 101",  name: "מגן דוד אדום",   icon: "🚑", desc: "פצועים וטיפול רפואי" },
};

// name = masculine, f = feminine (chosen by the officer's avatar)
export const RANKS = [
  { min: 0,    name: "שוטר",       f: "שוטרת" },
  { min: 300,  name: "סמל",        f: "סמלת" },
  { min: 700,  name: "רס\"ר",      f: "רס\"רית" },
  { min: 1200, name: "קצין",       f: "קצינה" },
  { min: 2000, name: "מפקד תחנה",  f: "מפקדת תחנה" },
];

export const AVATARS = [
  { id: "a1", icon: "👮‍♂️", name: "שוטר",  gender: "m" },
  { id: "a2", icon: "👮‍♀️", name: "שוטרת", gender: "f" },
  { id: "a3", icon: "🕵️‍♂️", name: "בלש",   gender: "m" },
  { id: "a4", icon: "🕵️‍♀️", name: "בלשית", gender: "f" },
];

export const MODES = [
  { id: "regular",  icon: "🚓", name: "משמרת רגילה",     desc: "כל סוגי האירועים, בקצב רגיל" },
  { id: "training", icon: "🎓", name: "אימון מוקדנים",   desc: "בלי לחץ זמן, עם רמזים. למתחילים" },
  { id: "night",    icon: "🌙", name: "משמרת לילה",      desc: "פריצות ואירועי לילה. בונוס נקודות" },
  { id: "rush",     icon: "⏱️", name: "מרוץ נגד השעון",  desc: "90 שניות לכל אירוע. מהירות = בונוס" },
  { id: "multi",    icon: "📞", name: "ריבוי אירועים",   desc: "כמה קריאות בבת אחת. קודם הדחופה!" },
];

// priority: 1 = urgent (red), 2 = medium (orange), 3 = routine (blue)
// night: true = can happen on the night shift
export const SCENES = [
  {
    id: "home_burglary", code: "פריצה לדירה", priority: 1, night: true,
    title: "פריצה לדירה ברחוב הגפן",
    callerIcon: "🧑", callerName: "שכן, רחוב הגפן",
    place: "neighborhood", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🥷", text: "פורץ נכנס לדירה של שכנים" },
    who:    { icon: "🏠", text: "בעלי הדירה שנסעו לחוץ לארץ" },
    action: { icon: "🚓", text: "לתפוס את הפורץ ולאבטח את הדירה" },
  },
  {
    id: "shop_breakin", code: "פריצה לעסק", priority: 1, night: true,
    title: "פריצה לחנות בקניון השוק",
    callerIcon: "💂", callerName: "שומר לילה, קניון השוק",
    place: "mall", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🔓", text: "פורץ מנסה לפתוח מנעול של חנות בלילה" },
    who:    { icon: "🏪", text: "בעל החנות" },
    action: { icon: "🛑", text: "לתפוס את הפורץ לפני שייכנס" },
  },
  {
    id: "car_breakin", code: "פריצה לרכב", priority: 2, night: true,
    title: "פריצה לרכב בחניון המרכזי",
    callerIcon: "👴", callerName: "שומר החניון המרכזי",
    place: "parking", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🚗", text: "מישהו עם מסכה פורץ לרכב" },
    who:    { icon: "🔑", text: "בעל הרכב" },
    action: { icon: "🚓", text: "לתפוס את הפורץ בחניון" },
  },
  {
    id: "bag_snatch", code: "חטיפת תיק", priority: 1,
    title: "חטיפת תיק ברחוב הרצל",
    callerIcon: "👩", callerName: "עוברת אורח, רחוב הרצל",
    place: "downtown", unit: "moto", okUnits: ["patrol"],
    what:   { icon: "👜", text: "מישהו חטף תיק מאישה וברח" },
    who:    { icon: "🙍‍♀️", text: "האישה שהתיק שלה נחטף" },
    action: { icon: "🏍️", text: "לרדוף אחרי החוטף ולהחזיר את התיק" },
  },
  {
    id: "lost_child", code: "ילד לבד", priority: 2,
    title: "ילד לבד בפארק העיר",
    callerIcon: "👩‍🦱", callerName: "מטיילת בפארק העיר",
    place: "park", unit: "community", okUnits: ["patrol"],
    what:   { icon: "🧒", text: "ילד קטן מסתובב לבד בלי הורים" },
    who:    { icon: "👶", text: "הילד" },
    action: { icon: "👨‍👩‍👦", text: "להישאר עם הילד עד שההורים יגיעו" },
  },
  {
    id: "cat_tree", code: "חילוץ בעל חיים", priority: 3,
    title: "חתול תקוע על עץ בגינת הפרחים",
    callerIcon: "👧", callerName: "ילדה מגינת הפרחים",
    place: "garden", unit: "community", okUnits: ["patrol", "fire"],
    what:   { icon: "🐱", text: "חתול תקוע על עץ וכלב נובח מתחתיו" },
    who:    { icon: "🐈", text: "החתול" },
    action: { icon: "🪜", text: "להרחיק את הכלב ולהוריד את החתול" },
  },
  {
    id: "red_light", code: "עבירת תנועה", priority: 2,
    title: "נהג עבר באור אדום בצומת העצמאות",
    callerIcon: "🚶", callerName: "הולך רגל, צומת העצמאות",
    place: "junction", unit: "traffic", okUnits: ["patrol", "moto"],
    what:   { icon: "🚕", text: "מונית עברה באור אדום" },
    who:    { icon: "🚸", text: "הולכי הרגל במעבר החצייה" },
    action: { icon: "📋", text: "לעצור את הנהג ולתת לו דוח" },
  },
  {
    id: "pickpocket", code: "כייסות", priority: 2,
    title: "כייס בקניון השוק",
    callerIcon: "👩‍💼", callerName: "מוכרת, קניון השוק",
    place: "mall", unit: "moto", okUnits: ["patrol"],
    what:   { icon: "📱", text: "כייס גנב טלפון מתיק של אישה" },
    who:    { icon: "👩", text: "האישה שהטלפון שלה נגנב" },
    action: { icon: "🔎", text: "לאתר את הכייס בקניון ולהחזיר את הטלפון" },
  },
  {
    id: "phone_snatch", code: "חטיפת טלפון", priority: 1,
    title: "חטיפת טלפון בתחנה המרכזית",
    callerIcon: "🙎‍♀️", callerName: "נוסעת, התחנה המרכזית",
    place: "busstop", unit: "moto", okUnits: ["patrol"],
    what:   { icon: "🏃", text: "בחור חטף טלפון מהיד וברח" },
    who:    { icon: "🙎‍♀️", text: "הבחורה שהטלפון שלה נחטף" },
    action: { icon: "🏍️", text: "לרדוף אחרי החוטף ולתפוס אותו" },
  },
  {
    id: "window_smash", code: "ונדליזם", priority: 2, night: true,
    title: "ניפוץ חלונות רכב בחניון המרכזי",
    callerIcon: "👴", callerName: "שומר החניון המרכזי",
    place: "parking", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🪟", text: "מישהו מנפץ חלונות של מכוניות" },
    who:    { icon: "🚗", text: "בעלי המכוניות בחניון" },
    action: { icon: "✋", text: "לתפוס את המנפץ ולעצור אותו" },
  },
  {
    id: "prowler", code: "חשוד מסתובב", priority: 2, night: true,
    title: "חשוד מציץ לחלונות בשכונת הגפן",
    callerIcon: "👩‍🦳", callerName: "תושבת, רחוב הגפן",
    place: "neighborhood", unit: "patrol", okUnits: ["community", "k9"],
    what:   { icon: "🔦", text: "חשוד מציץ לחלונות של בתים בלילה" },
    who:    { icon: "🏘️", text: "השכנים ברחוב" },
    action: { icon: "🚓", text: "לבדוק מי החשוד ולהרחיק אותו" },
  },
  {
    id: "tire_thief", code: "גניבה מרכב", priority: 3, night: true,
    title: "גנב מפרק גלגל ברחוב הרצל",
    callerIcon: "🧔", callerName: "תושב, רחוב הרצל",
    place: "downtown", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🛞", text: "גנב מפרק גלגל מרכב חונה" },
    who:    { icon: "🔑", text: "בעל הרכב החונה" },
    action: { icon: "🚓", text: "לתפוס את הגנב לפני שיברח עם הגלגל" },
  },
  {
    id: "hotel_burglar", code: "פריצה למלון", priority: 1, night: true,
    title: "פורץ בחדר במלון העיר",
    callerIcon: "🛎️", callerName: "פקיד קבלה, מלון העיר",
    place: "hotel", unit: "patrol", okUnits: ["moto"],
    what:   { icon: "🏨", text: "פורץ נכנס לחדר במלון" },
    who:    { icon: "🧳", text: "האורחים של המלון" },
    action: { icon: "🚓", text: "לתפוס את הפורץ בתוך החדר" },
  },
  {
    id: "field_fire", code: "שריפת חורשה", priority: 1,
    title: "שריפה בחורשה ליד פארק העיר",
    callerIcon: "🧑‍🌾", callerName: "גנן, פארק העיר",
    place: "park", unit: "fire", okUnits: ["patrol"],
    what:   { icon: "🔥", text: "שריפה בחורשה מתפשטת" },
    who:    { icon: "🏡", text: "התושבים בבתים ליד החורשה" },
    action: { icon: "🧯", text: "לכבות את האש לפני שתגיע לבתים" },
  },
  {
    id: "warehouse_fire", code: "שריפה במחסן", priority: 1, night: true,
    title: "שריפה במחסן באזור התעשייה",
    callerIcon: "👷", callerName: "שומר, אזור התעשייה",
    place: "industrial", unit: "fire", okUnits: ["patrol"],
    what:   { icon: "🏭", text: "מחסן עצים עולה באש" },
    who:    { icon: "👷", text: "העובדים והמחסנים שמסביב" },
    action: { icon: "🚒", text: "לכבות את השריפה ולמנוע התפשטות" },
  },
  {
    id: "tree_on_car", code: "מפגע בכביש", priority: 2,
    title: "עץ קרס על רכב בשכונת הגפן",
    callerIcon: "🧓", callerName: "תושבת, רחוב הגפן",
    place: "neighborhood", unit: "traffic", okUnits: ["fire", "patrol"],
    what:   { icon: "🌳", text: "עץ נפל על מכונית וחסם את הכביש" },
    who:    { icon: "🚙", text: "הנהגים שהרחוב שלהם חסום" },
    action: { icon: "🚧", text: "לחסום את הרחוב ולפנות את העץ" },
  },
  {
    id: "suspicious_bag", code: "חפץ חשוד", priority: 1,
    title: "תיק ללא בעלים בתחנת הרכבת",
    callerIcon: "🧑‍✈️", callerName: "מאבטח, תחנת הרכבת",
    place: "train", unit: "patrol", okUnits: ["community"],
    what:   { icon: "🎒", text: "תיק ללא בעלים על המסוע בתחנה" },
    who:    { icon: "🚆", text: "הנוסעים בתחנת הרכבת" },
    action: { icon: "🚧", text: "להרחיק את האנשים ולהזעיק חבלן" },
  },
  {
    id: "lost_dog", code: "בעל חיים אבוד", priority: 3,
    title: "כלב אבוד בגינת הפרחים",
    callerIcon: "👦", callerName: "ילד מגינת הפרחים",
    place: "garden", unit: "community", okUnits: ["patrol", "k9"],
    what:   { icon: "🐶", text: "כלב קטן ואבוד יושב על ספסל" },
    who:    { icon: "🐕", text: "הכלב" },
    action: { icon: "🏠", text: "לקחת את הכלב ולמצוא את הבעלים" },
  },
  {
    id: "kid_on_road", code: "ילדה בכביש", priority: 2,
    title: "ילדה רוכבת על אופניים בכביש ברחוב הרצל",
    callerIcon: "🧔", callerName: "נהג, רחוב הרצל",
    place: "downtown", unit: "community", okUnits: ["traffic", "patrol"],
    what:   { icon: "🚲", text: "ילדה קטנה רוכבת על אופניים בין המכוניות" },
    who:    { icon: "👧", text: "הילדה על האופניים" },
    action: { icon: "🛑", text: "להוריד את הילדה מהכביש ולמצוא את ההורים" },
  },
  {
    id: "speeding_moto", code: "מהירות מופרזת", priority: 2,
    title: "אופנוען במהירות מופרזת בכביש המהיר",
    callerIcon: "📡", callerName: "מוקד נתיבי ישראל",
    place: "highway", unit: "traffic", okUnits: ["moto"],
    what:   { icon: "🏍️", text: "אופנוען נוסע במהירות מופרזת ועוקף מסוכן" },
    who:    { icon: "🚗", text: "הנהגים בכביש המהיר" },
    action: { icon: "📋", text: "לעצור את האופנוען ולתת לו דוח" },
  },
  {
    id: "car_accident", code: "תאונת דרכים", priority: 1,
    title: "תאונת דרכים בכביש המהיר",
    callerIcon: "👩", callerName: "נהגת, הכביש המהיר",
    place: "highway", unit: "ambulance", okUnits: ["traffic", "fire"],
    what:   { icon: "💥", text: "שני רכבים התנגשו ונהג נפצע" },
    who:    { icon: "🤕", text: "הנהג שנפצע ביד" },
    action: { icon: "🚑", text: "לטפל בפצוע ולפנות את הכביש" },
  },
  {
    id: "tunnel_rescue", code: "חילוץ מרכב", priority: 1, night: true,
    title: "נהג לכוד ברכב במנהרה",
    callerIcon: "🧑", callerName: "נהג, המנהרה בכביש המהיר",
    place: "highway", unit: "fire", okUnits: ["ambulance"],
    what:   { icon: "🚗", text: "רכב נכנס בקיר במנהרה והנהג לכוד" },
    who:    { icon: "🧑", text: "הנהג שלכוד בתוך הרכב" },
    action: { icon: "🛠️", text: "לחלץ את הנהג מהרכב" },
  },
  {
    id: "missing_hiker", code: "נעדר", priority: 2,
    title: "מטייל נעדר בחורשה ליד פארק העיר",
    callerIcon: "👩‍🦰", callerName: "חברה של המטייל",
    place: "park", unit: "k9", okUnits: ["community", "patrol"],
    what:   { icon: "🥾", text: "מטייל הלך לאיבוד בחורשה ולא עונה לטלפון" },
    who:    { icon: "🧭", text: "המטייל שנעדר" },
    action: { icon: "🐕‍🦺", text: "לחפש את המטייל עם כלב גישוש" },
  },
];

export const QUESTIONS = [
  { key: "what",   line: "report_q1", label: "מה קרה?" },
  { key: "who",    line: "report_q2", label: "מי צריך עזרה?" },
  { key: "action", line: "report_q3", label: "מה צריך לעשות באירוע?" },
];

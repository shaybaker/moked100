"""Generates all narration (Hebrew, Microsoft neural voices via edge-tts) and
sound effects (synthesised with numpy) for the game.

    python3 tools/make_audio.py           # everything
    python3 tools/make_audio.py sfx       # only sound effects
    python3 tools/make_audio.py tts       # only narration (new or changed lines)
    python3 tools/make_audio.py tts --force   # re-record every line

Every recorded line is then tightened with ffmpeg: leading/trailing silence is
cut and pauses inside the line are capped at PAUSE seconds, so the narration
does not drag between words.

The narration text is also written to src/data/lines.json so the UI shows the
same sentence it speaks. A line whose text is a {"m": ..., "f": ...} pair is
recorded twice: <id>.mp3 for a male officer and <id>_f.mp3 for a female one.
"""
import asyncio
import json
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")
AUDIO = os.path.join(ROOT, "src", "assets", "audio")
DATA = os.path.join(ROOT, "src", "data")
LINES_JSON = os.path.join(DATA, "lines.json")
os.makedirs(AUDIO, exist_ok=True)
os.makedirs(DATA, exist_ok=True)

HILA = "he-IL-HilaNeural"
AVRI = "he-IL-AvriNeural"

# (voice, rate, pitch) presets. Only two Hebrew voices exist, so callers,
# field units and the commander are told apart by pace and pitch.
# Rates are brisk on purpose: the neural voices pause a lot on their own, and
# tighten() below also shortens every pause longer than PAUSE seconds.
DISPATCHER = (HILA, "+12%", "+0Hz")
COMMANDER = (AVRI, "+4%", "-12Hz")
FIELD = (AVRI, "+10%", "-4Hz")       # unit reporting back on the radio
MAN = (AVRI, "+12%", "+2Hz")         # worried caller
WOMAN = (HILA, "+12%", "+6Hz")       # worried caller
GIRL = (HILA, "+10%", "+18Hz")       # child caller
BOY = (AVRI, "+10%", "+16Hz")

PAUSE = 0.25        # longest silence kept inside a line, in seconds
LEAD, TAIL = 0.05, 0.12   # silence kept at the start / end of a line

# id: (preset, text) where preset and text may each be a {"m":..., "f":...} pair
LINES = {
    # --- dispatcher / guidance ---
    "welcome": (DISPATCHER, {"m": "מוקד מאה, ערב טוב. השוטר התורן מתבקש להתייצב בעמדה ולהתחיל משמרת.",
                             "f": "מוקד מאה, ערב טוב. השוטרת התורנית מתבקשת להתייצב בעמדה ולהתחיל משמרת."}),
    "ring": (DISPATCHER, {"m": "קריאה נכנסת בקו שלוש. תענה לשיחה.", "f": "קריאה נכנסת בקו שלוש. תעני לשיחה."}),
    "greeting": ({"m": MAN, "f": WOMAN}, "משטרה, מוקד מאה, שלום."),
    "watch": (DISPATCHER, "עוברים לשידור חי ממצלמת האבטחה הקרובה לאירוע."),
    "pick_place": (DISPATCHER, {"m": "תסמן במפה את מקום האירוע.", "f": "תסמני במפה את מקום האירוע."}),
    "pick_unit": (DISPATCHER, {"m": "תבחר איזה כוח לשלוח לאירוע.", "f": "תבחרי איזה כוח לשלוח לאירוע."}),
    "wrong_place": (DISPATCHER, {"m": "שלילי, זה לא מקום האירוע. תבדוק שוב.", "f": "שלילי, זה לא מקום האירוע. תבדקי שוב."}),
    "hint_place": (DISPATCHER, "המוקד מסמן את המיקום במפה."),
    "wrong_unit": (DISPATCHER, {"m": "יש כוח שמתאים יותר לאירוע הזה. תבחר שוב.", "f": "יש כוח שמתאים יותר לאירוע הזה. תבחרי שוב."}),
    "dispatched": (DISPATCHER, "רות, קיבלתי. הכוח יצא לדרך. זמן הגעה משוער: שתי דקות."),
    "arrived": (DISPATCHER, "הכוח הגיע לאירוע. עכשיו ממלאים דוח אירוע."),
    "report_q1": (DISPATCHER, "מה קרה?"),
    "report_q2": (DISPATCHER, "מי צריך עזרה?"),
    "report_q3": (DISPATCHER, "מה צריך לעשות באירוע?"),
    "correct": (DISPATCHER, "קיבלתי. ממשיכים."),
    "wrong": (DISPATCHER, {"m": "שלילי. תבדוק שוב.", "f": "שלילי. תבדקי שוב."}),
    "report_done": (DISPATCHER, "הדוח נשלח למפקד התחנה לאישור."),
    # --- game modes ---
    "intro_training": (DISPATCHER, "מצב אימון. בלי לחץ, עם רמזים. לוקחים את הזמן ולומדים."),
    "intro_night": (DISPATCHER, "משמרת לילה. השקט הזה לא יחזיק מעמד. עיניים פקוחות."),
    "intro_rush": (DISPATCHER, "מרוץ נגד השעון. תשעים שניות לכל אירוע. כל שנייה שווה נקודות."),
    "intro_multi": (DISPATCHER, {"m": "משמרת עמוסה הלילה. הקריאות ייכנסו כמה בבת אחת. תמיד תענה קודם לדחופה ביותר.",
                                 "f": "משמרת עמוסה הלילה. הקריאות ייכנסו כמה בבת אחת. תמיד תעני קודם לדחופה ביותר."}),
    "queue_intro": (DISPATCHER, {"m": "שים לב, כמה קריאות נכנסו בבת אחת. תענה קודם לקריאה הדחופה ביותר.",
                                 "f": "שימי לב, כמה קריאות נכנסו בבת אחת. תעני קודם לקריאה הדחופה ביותר."}),
    "queue_wrong": (DISPATCHER, "שלילי. יש קריאה דחופה יותר שמחכה על הקו."),
    "queue_ok": (DISPATCHER, "נכון, זו הקריאה הדחופה ביותר. עוברים אליה."),
    "time_up": (DISPATCHER, "הזמן נגמר. ממשיכים בלי בונוס זמן."),
    # --- commander ---
    "cmd_intro": (COMMANDER, {"m": "כאן מפקד התחנה. אני עובר על כל דוח שאתה שולח ונותן ציון. תעבוד לפי הנהלים ונסתדר מצוין.",
                              "f": "כאן מפקד התחנה. אני עובר על כל דוח שאת שולחת ונותן ציון. תעבדי לפי הנהלים ונסתדר מצוין."}),
    "cmd_3": (COMMANDER, "טיפול מצוין באירוע. שלושה כוכבים. כל הכבוד, ככה עובדים במשטרה."),
    "cmd_2": (COMMANDER, {"m": "טיפול טוב. שני כוכבים. בפעם הבאה תשים לב לפרטים הקטנים.",
                          "f": "טיפול טוב. שני כוכבים. בפעם הבאה תשימי לב לפרטים הקטנים."}),
    "cmd_1": (COMMANDER, "האירוע נסגר, אבל היו טעויות בדרך. כוכב אחד. נתאמן ונשתפר."),
    "cmd_rankup": (COMMANDER, {"m": "מזל טוב. בהחלטת מפקד התחנה, אתה מקודם בדרגה.",
                               "f": "מזל טוב. בהחלטת מפקד התחנה, את מקודמת בדרגה."}),
    "rank_0": (COMMANDER, {"m": "שוטר", "f": "שוטרת"}),
    "rank_1": (COMMANDER, {"m": "סמל", "f": "סמלת"}),
    "rank_2": (COMMANDER, {"m": "רב סמל ראשון", "f": "רב סמלת ראשונה"}),
    "rank_3": (COMMANDER, {"m": "קצין", "f": "קצינה"}),
    "rank_4": (COMMANDER, {"m": "מפקד תחנה", "f": "מפקדת תחנה"}),
    # --- units (speaker button on the unit card) ---
    "unit_patrol": (DISPATCHER, "ניידת סיור. מתאימה לפריצות, גניבות וחשודים."),
    "unit_moto": (DISPATCHER, "אופנוע משטרה. מהיר, למרדף אחרי מי שברח."),
    "unit_traffic": (DISPATCHER, "ניידת תנועה. כבישים, צמתים ונהגים."),
    "unit_community": (DISPATCHER, "שוטר קהילתי. עוזר לילדים, לקשישים ולבעלי חיים."),
    "unit_k9": (DISPATCHER, "יחידת הכלבנים. חיפוש נעדרים ואיתור חשודים."),
    "unit_fire": (DISPATCHER, "כבאית מאה ושתיים. שריפות וחילוץ מרכב."),
    "unit_ambulance": (DISPATCHER, "אמבולנס מאה ואחת. פצועים וטיפול רפואי."),
    # --- places (spoken when hovering the map) ---
    "place_neighborhood": (DISPATCHER, "שכונת הגפן"),
    "place_hotel": (DISPATCHER, "מלון העיר"),
    "place_mall": (DISPATCHER, "קניון השוק"),
    "place_highway": (DISPATCHER, "הכביש המהיר"),
    "place_parking": (DISPATCHER, "החניון המרכזי"),
    "place_downtown": (DISPATCHER, "רחוב הרצל"),
    "place_junction": (DISPATCHER, "צומת העצמאות"),
    "place_park": (DISPATCHER, "פארק העיר"),
    "place_train": (DISPATCHER, "תחנת הרכבת"),
    "place_garden": (DISPATCHER, "גינת הפרחים"),
    "place_busstop": (DISPATCHER, "התחנה המרכזית"),
    "place_industrial": (DISPATCHER, "אזור התעשייה"),
    # --- callers ---
    "call_home_burglary": (MAN, "הלו, משטרה? תשמעו, אני רואה עכשיו מישהו עם קפוצ'ון שחור נכנס לדירה של השכנים שלי ברחוב הגפן שתים עשרה. הם בחוץ לארץ, אין שם אף אחד! תשלחו ניידת מהר."),
    "call_shop_breakin": (MAN, "כאן השומר של קניון השוק. יש לי פה בן אדם עם מסכה שמנסה לפרוץ את המנעול של חנות התכשיטים, עכשיו, באמצע הלילה. אני רואה אותו במצלמות."),
    "call_car_breakin": (MAN, "שלום, מדבר השומר של החניון המרכזי. יש פה בחור עם מסכה שפורץ עכשיו לרכב לבן בקומה שתיים. הוא עדיין שם."),
    "call_bag_snatch": (WOMAN, "הלו! משטרה! מישהו חטף עכשיו תיק מאישה ברחוב הרצל וברח ברגל לכיוון השוק! היא בוכה פה. תמהרו!"),
    "call_lost_child": (WOMAN, "שלום, אני בפארק העיר, ליד השער הראשי. יש פה ילד קטן, בערך בן ארבע, שמסתובב לבד ובוכה. אני לא רואה שום הורה בסביבה."),
    "call_cat_tree": (GIRL, "היי, החתול שלנו טיפס על עץ בגינת הפרחים והוא לא מצליח לרדת, ויש כלב שעומד למטה ונובח עליו. הוא ממש מפחד."),
    "call_red_light": (MAN, "מונית עברה עכשיו באור אדום בצומת העצמאות, ממש כשאנשים חצו במעבר החצייה! כמעט דרסה אישה עם עגלה."),
    "call_pickpocket": (WOMAN, "שלום, אני מוכרת בקניון השוק. ראיתי עכשיו מישהו מוציא טלפון מהתיק של אישה בלי שהיא שמה לב. הוא עם ז'קט שחור, והוא עדיין מסתובב פה."),
    "call_phone_snatch": (WOMAN, "הלו, משטרה? חטפו לי עכשיו את הטלפון מהיד בתחנה המרכזית! בחור עם קפוצ'ון, הוא רץ לכיוון הכביש! אני מתקשרת מהטלפון של מישהי."),
    "call_window_smash": (MAN, "כאן השומר של החניון המרכזי. יש פה מישהו עם מסכה שמנפץ חלונות של מכוניות! כבר שבר שניים, אני שומע את הזכוכית מפה."),
    "call_prowler": (WOMAN, "ערב טוב, אני גרה ברחוב הגפן. יש פה מישהו עם מסכה שמסתובב בין הבתים ומציץ לחלונות עם פנס. עכשיו הוא ליד הבית של השכנים."),
    "call_tire_thief": (MAN, "שלום, אני מסתכל מהמרפסת ברחוב הרצל, ויש למטה בחור עם ז'קט שחור שמפרק גלגל מרכב חונה. זה לא הרכב שלו, אני מכיר את הבעלים."),
    "call_hotel_burglar": (MAN, "כאן הקבלה של מלון העיר. יש לנו במצלמה אדם עם מסכה בתוך אחד החדרים בקומה שלוש. האורחים לא בחדר. הוא עדיין שם."),
    "call_field_fire": (MAN, "יש שריפה! החורשה ליד פארק העיר בוערת, יש המון עשן והאש מתקדמת לכיוון הבתים! תשלחו כבאיות, מהר!"),
    "call_warehouse_fire": (MAN, "כאן השומר של אזור התעשייה. מחסן העצים עולה באש! יש להבות גדולות ועשן שחור. אין אנשים בפנים, אבל זה מתפשט מהר!"),
    "call_tree_on_car": (WOMAN, "שלום, בגלל הסערה עץ ענק נפל על מכונית ברחוב הגפן! אף אחד לא היה בפנים, אבל הכביש חסום ויש ענפים על כל הרחוב."),
    "call_suspicious_bag": (MAN, "שלום, אני מאבטח בתחנת הרכבת. יש פה תיק צהוב על המסוע כבר חצי שעה ואף אחד לא לוקח אותו. שאלתי מסביב, אין לו בעלים. זה נראה לי חשוד."),
    "call_lost_dog": (BOY, "היי, יש פה כלב קטן ולבן שיושב לבד על ספסל בגינת הפרחים. יש לו קולר אדום, הוא רועד ונראה אבוד. אין פה אף אחד שמכיר אותו."),
    "call_kid_on_road": (MAN, "הלו? יש ילדה קטנה שרוכבת לבד על אופניים בכביש ברחוב הרצל, ממש בין המכוניות! אין איתה מבוגר, זה מסוכן!"),
    "call_speeding_moto": (MAN, "כאן מוקד נתיבי ישראל. אופנוען עובר עכשיו בכביש המהיר במהירות מטורפת, עוקף מימין ומשמאל. הוא מסכן את כל הנהגים."),
    "call_car_accident": (WOMAN, "הייתה עכשיו תאונה בכביש המהיר! שני רכבים התנגשו, הנהג של הרכב הלבן מחזיק את היד ואומר שכואב לו. אנחנו עומדים בצד."),
    "call_tunnel_rescue": (MAN, "הלו, משטרה! תאונה במנהרה בכביש המהיר! רכב נכנס בקיר, הנהג בסדר אבל הוא לא מצליח לצאת, הדלת תקועה! צריך מישהו שיחלץ אותו!"),
    "call_missing_hiker": (WOMAN, "שלום, החבר שלי יצא לטייל בחורשה ליד פארק העיר לפני שלוש שעות ולא חזר. הטלפון שלו לא עונה, ומתחיל להחשיך. אני דואגת."),
    # --- field units reporting back on the radio ---
    "done_home_burglary": (FIELD, "ניידת עשרים ואחת עבור מוקד. הפורץ נעצר בתוך הדירה, כל החפצים חזרו לבעלים. האירוע סגור."),
    "done_shop_breakin": (FIELD, "עבור מוקד, תפסנו את הפורץ ליד דלת החנות לפני שהספיק להיכנס. סגור."),
    "done_car_breakin": (FIELD, "עבור מוקד, הפורץ נתפס בקומה שתיים בחניון. בעל הרכב עודכן, האירוע סגור."),
    "done_bag_snatch": (FIELD, "אופנוע שבע עבור מוקד. השגנו את החוטף אחרי מרדף קצר, התיק חזר לבעלים. סגור."),
    "done_lost_child": (FIELD, "קהילתי שתים עשרה עבור מוקד. נשארתי עם הילד עד שההורים הגיעו, הכל בסדר. סגור."),
    "done_cat_tree": (FIELD, "עבור מוקד, הרחקנו את הכלב והורדנו את החתול בשלום. הילדה מחייכת. סגור."),
    "done_red_light": (FIELD, "תנועה ארבע עבור מוקד. עצרנו את המונית, הנהג קיבל דוח על נסיעה באור אדום. סגור."),
    "done_pickpocket": (FIELD, "עבור מוקד, איתרנו את הכייס ליד היציאה מהקניון. הטלפון חזר לאישה. סגור."),
    "done_phone_snatch": (FIELD, "אופנוע שבע עבור מוקד. תפסנו את החוטף ליד הכביש, הטלפון חזר לבעלים. סגור."),
    "done_window_smash": (FIELD, "עבור מוקד, המנפץ נעצר בחניון. בעלי הרכבים עודכנו. סגור."),
    "done_prowler": (FIELD, "עבור מוקד, איתרנו את החשוד עם הפנס בין הבתים. הוא נלקח לתחנה לבירור, השכונה שקטה. סגור."),
    "done_tire_thief": (FIELD, "עבור מוקד, תפסנו את הגנב עם הגלגל ביד. הגלגל חזר לרכב. סגור."),
    "done_hotel_burglar": (FIELD, "עבור מוקד, הפורץ נעצר בתוך החדר בקומה שלוש. האורחים קיבלו את החפצים שלהם. סגור."),
    "done_field_fire": (FIELD, "כבאית מאה ושתיים עבור מוקד. השריפה בחורשה כובתה, אף בית לא נפגע. סגור."),
    "done_warehouse_fire": (FIELD, "כבאית עבור מוקד. האש במחסן בשליטה וכובתה. אין נפגעים. סגור."),
    "done_tree_on_car": (FIELD, "תנועה ארבע עבור מוקד. הרחוב נחסם, העץ פונה והכביש פתוח. סגור."),
    "done_suspicious_bag": (FIELD, "עבור מוקד, הרחקנו את הנוסעים והחבלן בדק את התיק. התברר שזה תיק של תייר שהלך לאכול. סגור."),
    "done_lost_dog": (FIELD, "קהילתי שתים עשרה עבור מוקד. הכלב איתי, על הקולר היה מספר טלפון. הבעלים בדרך. סגור."),
    "done_kid_on_road": (FIELD, "עבור מוקד, הילדה ירדה מהכביש למדרכה בשלום. ההורים אותרו ועודכנו. סגור."),
    "done_speeding_moto": (FIELD, "תנועה ארבע עבור מוקד. עצרנו את האופנוען במחלף. הרישיון נשלל והוא קיבל דוח. סגור."),
    "done_car_accident": (FIELD, "אמבולנס מאה ואחת עבור מוקד. הנהג קיבל טיפול ביד, הוא במצב קל. הכביש פונה. סגור."),
    "done_tunnel_rescue": (FIELD, "כבאית עבור מוקד. חילצנו את הנהג מהרכב, הוא בסדר גמור. המנהרה נפתחה לתנועה. סגור."),
    "done_missing_hiker": (FIELD, "כלבן תשע עבור מוקד. הכלב מצא את המטייל ליד הנחל, קצת רטוב אבל בריא. סגור."),
}

# report answer options (what happened / who needs help / what to do), read
# aloud when the child presses the speaker button. Must match SCENES in
# src/js/content.js word for word.
OPTIONS = {
    "home_burglary": ("פורץ נכנס לדירה של שכנים", "בעלי הדירה שנסעו לחוץ לארץ", "לתפוס את הפורץ ולאבטח את הדירה"),
    "shop_breakin": ("פורץ מנסה לפתוח מנעול של חנות בלילה", "בעל החנות", "לתפוס את הפורץ לפני שייכנס"),
    "car_breakin": ("מישהו עם מסכה פורץ לרכב", "בעל הרכב", "לתפוס את הפורץ בחניון"),
    "bag_snatch": ("מישהו חטף תיק מאישה וברח", "האישה שהתיק שלה נחטף", "לרדוף אחרי החוטף ולהחזיר את התיק"),
    "lost_child": ("ילד קטן מסתובב לבד בלי הורים", "הילד", "להישאר עם הילד עד שההורים יגיעו"),
    "cat_tree": ("חתול תקוע על עץ וכלב נובח מתחתיו", "החתול", "להרחיק את הכלב ולהוריד את החתול"),
    "red_light": ("מונית עברה באור אדום", "הולכי הרגל במעבר החצייה", "לעצור את הנהג ולתת לו דוח"),
    "pickpocket": ("כייס גנב טלפון מתיק של אישה", "האישה שהטלפון שלה נגנב", "לאתר את הכייס בקניון ולהחזיר את הטלפון"),
    "phone_snatch": ("בחור חטף טלפון מהיד וברח", "הבחורה שהטלפון שלה נחטף", "לרדוף אחרי החוטף ולתפוס אותו"),
    "window_smash": ("מישהו מנפץ חלונות של מכוניות", "בעלי המכוניות בחניון", "לתפוס את המנפץ ולעצור אותו"),
    "prowler": ("חשוד מציץ לחלונות של בתים בלילה", "השכנים ברחוב", "לבדוק מי החשוד ולהרחיק אותו"),
    "tire_thief": ("גנב מפרק גלגל מרכב חונה", "בעל הרכב החונה", "לתפוס את הגנב לפני שיברח עם הגלגל"),
    "hotel_burglar": ("פורץ נכנס לחדר במלון", "האורחים של המלון", "לתפוס את הפורץ בתוך החדר"),
    "field_fire": ("שריפה בחורשה מתפשטת", "התושבים בבתים ליד החורשה", "לכבות את האש לפני שתגיע לבתים"),
    "warehouse_fire": ("מחסן עצים עולה באש", "העובדים והמחסנים שמסביב", "לכבות את השריפה ולמנוע התפשטות"),
    "tree_on_car": ("עץ נפל על מכונית וחסם את הכביש", "הנהגים שהרחוב שלהם חסום", "לחסום את הרחוב ולפנות את העץ"),
    "suspicious_bag": ("תיק ללא בעלים על המסוע בתחנה", "הנוסעים בתחנת הרכבת", "להרחיק את האנשים ולהזעיק חבלן"),
    "lost_dog": ("כלב קטן ואבוד יושב על ספסל", "הכלב", "לקחת את הכלב ולמצוא את הבעלים"),
    "kid_on_road": ("ילדה קטנה רוכבת על אופניים בין המכוניות", "הילדה על האופניים", "להוריד את הילדה מהכביש ולמצוא את ההורים"),
    "speeding_moto": ("אופנוען נוסע במהירות מופרזת ועוקף מסוכן", "הנהגים בכביש המהיר", "לעצור את האופנוען ולתת לו דוח"),
    "car_accident": ("שני רכבים התנגשו ונהג נפצע", "הנהג שנפצע ביד", "לטפל בפצוע ולפנות את הכביש"),
    "tunnel_rescue": ("רכב נכנס בקיר במנהרה והנהג לכוד", "הנהג שלכוד בתוך הרכב", "לחלץ את הנהג מהרכב"),
    "missing_hiker": ("מטייל הלך לאיבוד בחורשה ולא עונה לטלפון", "המטייל שנעדר", "לחפש את המטייל עם כלב גישוש"),
}
for _sid, _texts in OPTIONS.items():
    for _q, _t in zip(("what", "who", "action"), _texts):
        LINES[f"opt_{_sid}_{_q}"] = (DISPATCHER, _t)


def flat_lines():
    """Expands {"m","f"} pairs into <id> and <id>_f entries: id -> (voice, rate, pitch, text)."""
    out = {}
    for key, (preset, text) in LINES.items():
        if isinstance(text, dict) or isinstance(preset, dict):
            for g, suffix in (("m", ""), ("f", "_f")):
                p = preset[g] if isinstance(preset, dict) else preset
                t = text[g] if isinstance(text, dict) else text
                out[key + suffix] = (*p, t)
        else:
            out[key] = (*preset, text)
    return out


SR = 44100


def write_wav(name, samples):
    samples = np.clip(samples, -1, 1)
    path = os.path.join(AUDIO, name + ".wav")
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((samples * 32767).astype("<i2").tobytes())
    # convert to mp3 so every effect shares one format
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-codec:a", "libmp3lame", "-q:a", "4",
                    os.path.join(AUDIO, name + ".mp3")], check=True)
    os.remove(path)


def tone(freq, dur, vol=0.5, shape="sine", attack=0.01, release=0.05):
    n = int(SR * dur)
    t = np.arange(n) / SR
    if shape == "square":
        s = np.sign(np.sin(2 * np.pi * freq * t))
    elif shape == "tri":
        s = 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1
    else:
        s = np.sin(2 * np.pi * freq * t)
    env = np.ones(n)
    a, r = int(SR * attack), int(SR * release)
    env[:a] = np.linspace(0, 1, a)
    env[n - r:] = np.linspace(1, 0, r)
    return s * env * vol


def silence(dur):
    return np.zeros(int(SR * dur))


def make_sfx():
    # phone ring: two short trills, repeated
    trill = np.concatenate([tone(880, 0.05, 0.4, "tri") + tone(1320, 0.05, 0.2, "tri") for _ in range(12)])
    ring = np.concatenate([trill, silence(0.25), trill, silence(1.2)])
    write_wav("sfx_ring", np.tile(ring, 2))

    # siren: sweeping between two pitches, 3 seconds
    n = int(SR * 3.0)
    t = np.arange(n) / SR
    f = 700 + 300 * np.sin(2 * np.pi * 0.8 * t)
    phase = 2 * np.pi * np.cumsum(f) / SR
    siren = np.sin(phase) * 0.35
    env = np.ones(n)
    env[-SR // 2:] = np.linspace(1, 0, SR // 2)
    write_wav("sfx_siren", siren * env)

    # click
    write_wav("sfx_click", tone(1200, 0.06, 0.4, "sine", release=0.04))

    # correct ding: rising major arpeggio
    write_wav("sfx_correct", np.concatenate([tone(523, 0.12, 0.4), tone(659, 0.12, 0.4), tone(784, 0.25, 0.45)]))

    # wrong: soft low double tone (not scary)
    write_wav("sfx_wrong", np.concatenate([tone(300, 0.15, 0.3, "tri"), silence(0.05), tone(250, 0.25, 0.3, "tri")]))

    # star: sparkle
    write_wav("sfx_star", np.concatenate([tone(1047, 0.08, 0.35), tone(1319, 0.08, 0.35), tone(1568, 0.08, 0.35), tone(2093, 0.3, 0.4)]))

    # fanfare for the commander screen
    fan = np.concatenate([tone(523, 0.18, 0.4, "tri"), tone(659, 0.18, 0.4, "tri"), tone(784, 0.18, 0.4, "tri"),
                          tone(1047, 0.5, 0.45, "tri")])
    write_wav("sfx_fanfare", fan)

    # radio beep (dispatch confirmation)
    write_wav("sfx_radio", np.concatenate([tone(1500, 0.08, 0.3, "square"), silence(0.05), tone(1500, 0.08, 0.3, "square")]))

    # countdown tick (rush mode, last seconds)
    write_wav("sfx_tick", tone(2000, 0.04, 0.25, "square", release=0.02))
    print("sfx done")


def tighten(path):
    """Trims leading/trailing silence and shortens every pause inside the line to PAUSE seconds.

    Decodes to wav first: the mp3 muxer in older ffmpeg builds complains about timestamps
    coming straight out of silenceremove."""
    wav = path[:-4] + ".tmp.wav"
    trim = (f"silenceremove=start_periods=1:start_silence={LEAD}:start_threshold=-45dB:"
            f"stop_periods=-1:stop_silence={PAUSE}:stop_threshold=-45dB:detection=peak,"
            f"areverse,silenceremove=start_periods=1:start_silence={TAIL}:start_threshold=-45dB:detection=peak,areverse")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-af", trim, wav], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "4", path], check=True)
    os.remove(wav)


async def make_tts(force=False):
    import edge_tts
    proxy = os.environ.get("HTTPS_PROXY")
    lines = flat_lines()
    try:
        with open(LINES_JSON, encoding="utf-8") as f:
            previous = json.load(f)
    except (OSError, ValueError):
        previous = {}
    for key, (voice, rate, pitch, text) in lines.items():
        out = os.path.join(AUDIO, f"{key}.mp3")
        fresh = os.path.exists(out) and os.path.getsize(out) > 1000 and previous.get(key) == text
        if fresh and not force:
            continue
        for attempt in range(4):
            try:
                c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=proxy)
                await c.save(out)
                tighten(out)
                break
            except Exception as e:  # noqa: BLE001
                print("retry", key, e)
                await asyncio.sleep(2 + attempt * 2)
        print("tts", key)
    with open(LINES_JSON, "w", encoding="utf-8") as f:
        json.dump({k: v[3] for k, v in lines.items()}, f, ensure_ascii=False, indent=1)
    known = set(lines) | {"sfx_ring", "sfx_siren", "sfx_click", "sfx_correct", "sfx_wrong", "sfx_star", "sfx_fanfare",
                          "sfx_radio", "sfx_tick"}
    stale = sorted(f[:-4] for f in os.listdir(AUDIO) if f.endswith(".mp3") and f[:-4] not in known)
    if stale:
        print("stale audio files (safe to delete):", ", ".join(stale))


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    force = "--force" in sys.argv
    if what in ("all", "sfx"):
        make_sfx()
    if what in ("all", "tts"):
        asyncio.run(make_tts(force))

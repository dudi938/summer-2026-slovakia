# מסמך דרישות ומצב הפרויקט - חופשה משפחתית בסלובקיה 2026

**תאריך עדכון:** 2026-07-14  
**אתר חי:** https://dudi938.github.io/summer-2026-slovakia/  
**ריפו:** https://github.com/dudi938/summer-2026-slovakia

---

## חלק א': דרישות המשתמש

### 1. תיאור הטיול

| פרט | ערך |
|------|------|
| יעד | סלובקיה - הרי הטטרה |
| תאריכים | 1-11 באוגוסט 2026 |
| משפחה | הורים + ילדים בגילאי 17, 13, 10, 1 (תינוק) |
| שמירת שבת/כשרות | כן - צריך בית חב"ד לשבת |
| נקודת בסיס | Malatíny 032 15 (2.5 שעות מברטיסלבה) |
| מבנה הטיול | נחיתה בברטיסלבה → נסיעה לטטרה (שלישי-חמישי) → חזרה לברטיסלבה/וינה/הונגריה/צ'כיה לשבת |

### 2. פוקוס אטרקציות (מה כן)
- רפטינג
- פארקי חבלים
- מגלשות הרים (alpine coasters / bobsled)
- עגלות הרים (mountain carts / תלת-אופן)
- מפלים
- שייט (סירות, קיאקים)
- נופים ותצפיות
- אגמים
- Zip lines
- רכיבת אופניים
- הרפתקאות ואקסטרים

### 3. לא רלוונטי (מה לא)
- **מבצרים וארמונות** - לא מעניין
- **ארכיאולוגיה והיסטוריה** - לא מעניין
- **ספא** - לא מעניין
- **פארקי מים (אקווה-פארקים)** - לא מעניין
- **בתי מרחץ תרמליים** - לא מעניין

### 4. דרישות האתר

#### 4.1 דרישות כלליות
- אתר GitHub Pages סטטי (ללא framework, ללא build)
- **עברית מלאה** - כל הטקסט, תיאורים, הערות, תגיות - הכל בעברית
- RTL layout
- Mobile-first responsive
- צבעים בהירים ועליזים
- פונט Heebo (Google Fonts)

#### 4.2 תוכן כל אטרקציה
- שם בעברית
- תיאור בעברית
- אתר אינטרנט (קישור)
- כתובת מלאה
- מחיר (מבוגר/ילד)
- דגשים/הערות (בעברית)
- למי מתאים (גילאים, תינוק)
- מפה + כפתור Google Maps
- **תמונות אמיתיות** (לא placeholder)
- מרחק מנקודת הבסיס (Malatíny)
- ציון משפחתי (1-5)

#### 4.3 פיצ'רים באתר
- חיפוש טקסט חופשי
- סינון לפי: אזור, קטגוריה, מתאים לתינוק, ציון משפחתי
- מפה אינטראקטיבית (Leaflet.js)
- תפריט ניווט responsive (דסקטופ + מובייל)
- מצב "תוכנית יום" - הוספת אטרקציות לתכנון יומי (localStorage)
- כפתור צף: חזרה למעלה + חזרה לדף הבית
- מיון: לפי ציון, שם, מרחק, אזור
- תצוגת grid/map toggle

#### 4.4 מבנה עמודים
- **דף בית** - כל האטרקציות + חיפוש + סינון
- **מפה** - מפה אינטראקטיבית של כל האטרקציות
- **5 עמודי אזורים**: הרי הטטרה, ברטיסלבה, וינה, בודפשט, צ'כיה
- **4 עמודי קטגוריות**: ספורט מים, הרפתקאות, טבע ונופים, אופניים
- **שבת וכשרות** - בתי חב"ד, בתי כנסת, כשרות

### 5. תהליך עבודה נדרש
1. מחקר עומק (50+ אטרקציות) - parallel agents
2. שליחת סיכום ב-Slack לאישור (ערוץ D0125AFA4UT)
3. המתנה לאישור
4. בניית האתר
5. שליחת הודעת סיום ב-Slack עם קישור

---

## חלק ב': ארכיטקטורה ומימוש טכני

### 1. סטאק טכנולוגי

| רכיב | טכנולוגיה |
|-------|-----------|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Hosting | GitHub Pages (legacy build from main) |
| Maps | Leaflet.js 1.9.4 |
| Font | Google Fonts - Heebo |
| Data | JSON file loaded by fetch() |
| Storage | localStorage (day plan) |
| Build | אין - static files בלבד |

### 2. מבנה קבצים

```
summer-2026-slovakia/
├── index.html              # דף בית ראשי (~450 שורות)
├── map.html                # עמוד מפה מלא
├── shabbat.html            # עמוד שבת וכשרות
├── areas/
│   ├── high-tatras.html    # עמוד הרי הטטרה
│   ├── bratislava.html     # עמוד ברטיסלבה
│   ├── vienna.html         # עמוד וינה
│   ├── budapest.html       # עמוד בודפשט
│   └── czech.html          # עמוד צ'כיה
├── categories/
│   ├── water-sports.html   # ספורט מים
│   ├── adventure.html      # הרפתקאות
│   ├── nature.html         # טבע ונופים
│   └── cycling.html        # אופניים
├── css/
│   └── style.css           # כל ה-CSS (~1260 שורות)
├── js/
│   └── app.js              # כל הלוגיקה (~1100 שורות)
├── data/
│   ├── attractions.json    # מאגר נתונים ראשי (211 אטרקציות)
│   ├── images.json         # מיפוי תמונות (106 URLs)
│   └── raw-research.json   # נתוני מחקר גולמיים
└── .agents/artifacts/
    └── project-spec.md     # מסמך זה
```

### 3. ארכיטקטורת נתונים

#### attractions.json - מבנה רשומה
```json
{
  "id": "mountain-carts-jasna",
  "name": "Mountain Carts Jasná",
  "nameHebrew": "עגלות הרים - יאסנה",
  "category": "adventure",
  "area": "high-tatras",
  "description": "English description...",
  "descriptionHebrew": "תיאור בעברית...",
  "address": "Full address",
  "website": "https://...",
  "priceAdult": "~10€",
  "priceChild": "~7€",
  "coordinates": {"lat": 48.97, "lng": 19.58},
  "suitableFor": ["teens", "children 4+", "adults"],
  "suitableForBaby": false,
  "notes": "English notes",
  "notesHebrew": "הערות בעברית",
  "distanceFromMalatiny": "30 km, approx 30 minutes drive",
  "familyScore": 5,
  "dayTripCluster": "liptov-area",
  "imageUrl": "https://upload.wikimedia.org/...",
  "googleMapsUrl": "https://www.google.com/maps?q=...",
  "tags": ["עגלות הרים", "הרפתקה"],
  "source": "https://..."
}
```

#### סטטיסטיקות נוכחיות
| מדד | ערך |
|------|------|
| סה"כ אטרקציות | 211 |
| עם תמונות | 211 (100%) ✅ |
| עם תיאור עברי (לא אנגלית) | 7 (3%) ❌ |
| מתאים לתינוק | 74 |

#### חלוקה לפי אזור
| אזור | כמות |
|-------|------|
| הרי הטטרה | 155 |
| וינה | 23 |
| ברטיסלבה | 14 |
| בודפשט | 10 |
| צ'כיה | 6 |
| סלובקיה - אחר | 3 |

#### חלוקה לפי קטגוריה
| קטגוריה | כמות |
|----------|------|
| טבע | 75 |
| הרפתקאות | 55 |
| ספורט מים | 41 |
| אופניים | 20 |
| שבת | 16 |
| משפחה | 3 |
| אחר | 1 |

### 4. ארכיטקטורת ה-JS (app.js)

#### מבנה ראשי
- **Global State**: allAttractions, filteredAttractions, map, markers, activeFilters, currentSort, dayPlan
- **Data Loading**: loadAttractions() - fetch JSON, apply page-level filter if exists
- **Filters**: applyFilters() - combines search, area, category, baby, score
- **Rendering**: renderAttractions() - creates DOM cards dynamically
- **Map**: initMap(), renderMarkers() - Leaflet integration
- **Day Plan**: addToPlan(), removeFromPlan(), clearPlan() - localStorage persistence
- **Navigation**: setupNavigation(), setupFilters(), setupSort(), setupFloatingButtons()

#### מנגנון סינון עמודים
עמודי area/category משתמשים ב-`data-filter-type` ו-`data-filter-value` על `<body>`:
```html
<body data-filter-type="area" data-filter-value="high-tatras">
```
הלוגיקה ב-loadAttractions() מסננת את allAttractions לפי זה לפני שמציגה.

### 5. CSS Architecture

- CSS Variables לצבעים, פונטים, shadows, transitions
- Mobile-first: base styles → `@media (min-width: 768px)` overrides
- RTL native: `dir="rtl"` on `<html>`
- Components: header, hero, filters, cards, map, day-plan, floating-btns, bottom-nav
- Grid system: CSS Grid with auto-fill, minmax(300px, 1fr)

---

## חלק ג': באגים שדווחו ודרישות חדשות

### באגים שתוקנו (FIXED)

| # | באג | סטטוס | תיקון |
|---|------|--------|--------|
| 1 | קטגוריות ריקות - עמודי area/category לא מציגים כלום | ✅ תוקן | הוספת data-filter-type/value על body + לוגיקה ב-loadAttractions() |
| 2 | תוכנית יום - לוחצים "הוסף" אבל לא קורה כלום | ✅ תוקן | תוקן DOM element id (day-plan-items vs day-plan-list) + הצגת day-plan-actions div |
| 3 | טעינת קובץ נתונים שגויה | ✅ תוקן | שינוי מ-filtered-attractions.json ל-attractions.json |
| 4 | 92 אטרקציות מסווגות כ-"other-slovakia" במקום "high-tatras" | ✅ תוקן | Python script עם סיווג מחדש לפי קואורדינטות |
| 5 | כפתור צף נראה רע במובייל (חופף לתוכן ול-bottom-nav) | ✅ תוקן | CSS redesign ל-pill-bar מרכזי + bottom:70px במובייל |
| 6 | כפתור צף לא מופיע בדסקטופ בכלל | ✅ תוקן | הוספת container-level .visible class + scroll listener |
| 7 | סינון "מתאים לתינוקות" לא עובד | ✅ תוקן | הוספת event listener ל-#baby-filter |
| 8 | סינון "ציון 4+" / "ציון 5" לא עובד | ✅ תוקן | הוספת event listeners ל-#score-filter-4 ו-#score-filter-5 |
| 9 | כפתור "הכל" באזורים/קטגוריות מגדיר filter ל-"all" במקום לאפס | ✅ תוקן | לוגיקה חדשה: all → reset filter |

### באגים/בעיות שעדיין פתוחים (OPEN)

| # | בעיה | סטטוס | הערות |
|---|-------|--------|-------|
| 1 | **כל התיאורים באנגלית** - descriptionHebrew זהה ל-description ב-204 מתוך 211 אטרקציות | ❌ פתוח | workflow תרגום הושק (wf_84d64e3b-e80, 8 batch agents) - לא הושלם ולא הוחל |
| 2 | **הערות באנגלית** - notesHebrew = notes ברוב האטרקציות | ❌ פתוח | חלק מאותו workflow תרגום |
| 3 | ~~105 אטרקציות ללא תמונה~~ | ✅ תוקן (2026-07-14) | 211/211 עם תמונות - 94 unique URLs מ-Wikimedia Commons + אתרים רשמיים |
| 4 | **suitableFor באנגלית** - תוויות כמו "teens", "adults" לא מתורגמות | ❌ פתוח | צריך תרגום או מיפוי |
| 5 | **tags חלקם באנגלית** | ❌ פתוח | חלק מהתגיות בעברית, חלק באנגלית |
| 6 | **מספר האטרקציות ב-hero** כתוב 204 קשיח (צריך להיות 211 או דינמי) | ❌ פתוח | ערך קשיח ב-index.html |
| 7 | **Agent "Add 30 more attractions"** עדיין רץ | ⏳ בהמתנה | a87cd9ca9a39c3e11 |

### דרישות חדשות שהתבקשו

| # | דרישה | סטטוס | הערות |
|---|--------|--------|-------|
| 1 | הכל בעברית מלאה - תיאורים, הערות, תגיות, labels | ❌ חלקי | רק 7 אטרקציות חדשות בעברית |
| 2 | תמונות אמיתיות מהרשת (לא placeholder) | ⚠️ חלקי | 106 מ-Wikimedia Commons הוחלו |
| 3 | הוספת עוד אטרקציות ממקורות נוספים | ⚠️ חלקי | Agent רץ + נוספו 7 ידנית |
| 4 | כפתור צף: חזרה למעלה + דף הבית | ✅ הושלם | pill-bar מרכזי, desktop+mobile |
| 5 | הוספת Mountain Carts (vt.sk + bachledka) | ✅ הושלם | 3 אטרקציות עגלות הרים |
| 6 | הוספת מגלשות הרים (bobová dráha) | ✅ הושלם | 4 alpine coasters נוספו |
| 7 | חיפוש וגילוי תלת-אופני הרים נוספים | ✅ הושלם | Mountain Carts Jasná נוסף |

---

## חלק ד': סיכום מצב - מה עובד ומה לא

### עובד ✅
- [x] האתר חי וזמין ב-GitHub Pages
- [x] מבנה עמודים מלא (בית, מפה, 5 אזורים, 4 קטגוריות, שבת)
- [x] חיפוש טקסט חופשי
- [x] סינון לפי אזור (chip buttons)
- [x] סינון לפי קטגוריה (chip buttons)
- [x] סינון מתאים לתינוקות
- [x] סינון לפי ציון משפחתי (4+/5)
- [x] מיון (שם, ציון, מרחק, אזור)
- [x] מפה אינטראקטיבית (Leaflet) עם markers צבעוניים
- [x] כרטיסי אטרקציה עם כל הפרטים
- [x] כפתור Google Maps בכל כרטיס
- [x] קישור לאתר בכל כרטיס
- [x] תוכנית יום (הוספה/הסרה/שיתוף) - localStorage
- [x] תפריט desktop עם dropdowns
- [x] תפריט mobile (hamburger + side panel)
- [x] Bottom navigation (mobile)
- [x] כפתורים צפים (חזרה למעלה + דף הבית) - desktop+mobile
- [x] RTL layout מלא
- [x] Responsive design (mobile-first)
- [x] 211 אטרקציות במאגר
- [x] 106 תמונות אמיתיות (Wikimedia)
- [x] Mountain carts (3 אטרקציות)
- [x] Alpine coasters / bobsled (4 אטרקציות)
- [x] עמודי area/category מסננים נכון
- [x] Grid/Map view toggle

### לא עובד / חסר ❌
- [ ] **תרגום לעברית** - 97% מהתיאורים עדיין באנגלית
- [ ] **תרגום הערות** - notesHebrew = notes (אנגלית) ברוב האטרקציות
- [ ] **תרגום suitableFor** - מופיע באנגלית בכרטיסים ("teens", "adults")
- [ ] **50% ללא תמונה** - 105 אטרקציות ללא imageUrl
- [ ] **מספר אטרקציות ב-hero** - כתוב 204 קשיח (צריך 211)
- [ ] **tags חלקית באנגלית** - משפיע על חיפוש
- [ ] **מחירים לא אחידים** - חלקם "Check website", חלקם "~10€", חלקם "Free"
- [ ] **distances לא בעברית** - "30 km, approx 30 minutes drive"

### דורש בדיקה נוספת ⚠️
- [ ] האם כל הלינקים לאתרים חיצוניים תקינים?
- [ ] האם כל הקואורדינטות מדויקות?
- [ ] האם ה-map.html מציג סימנים לכל 211 האטרקציות?
- [ ] האם עמוד שבת מלא ומעודכן?
- [ ] ביצועי טעינה (211 אטרקציות ב-JSON אחד)
- [ ] עיצוב כרטיסים כשאין תמונה (fallback)

---

## חלק ה': סדר עדיפויות להשלמה

### עדיפות גבוהה (חוסם חוויה)
1. **תרגום כל התיאורים לעברית** - המשתמש דרש במפורש "הכל בעברית מלאה"
2. **תרגום הערות (notes) לעברית**
3. **השלמת תמונות** - 105 אטרקציות ללא תמונה

### עדיפות בינונית (שיפור חוויה)
4. תרגום suitableFor ל-labels עבריים
5. תרגום distances לפורמט עברי
6. עדכון מספר אטרקציות דינמי ב-hero
7. קליטת תוצאות מ-agent "30 more attractions"

### עדיפות נמוכה (ליטוש)
8. אחידות מחירים
9. בדיקת לינקים חיצוניים
10. Fallback/placeholder לכרטיסים ללא תמונה
11. Accessibility audit
12. Performance optimization

---

## חלק ו': Agents רצים ברקע

| Agent ID | תיאור | סטטוס |
|----------|--------|--------|
| ab247cdc583b678c9 | Find real images for attractions | ✅ הושלם - 211/211 כיסוי |
| a87cd9ca9a39c3e11 | Add 30 more attractions quickly | ⏳ רץ |
| wf_84d64e3b-e80 | Translation workflow (8 batches × 25) | ❓ לא ידוע (הושק בסשן קודם) |

---

## חלק ז': ערוצי תקשורת

- **Slack Channel:** D0125AFA4UT (DM with dgershtenkoren)
- **Slack User ID:** W012GDNRFDF
- **GitHub User:** dudi938
- **Email:** dgershtenkoren@salesforce.com

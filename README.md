# Дархан Ус Суваг — вэб сайт

Усны замналын storytelling вэб сайт: **УС ЭХЭЛНЭ → ЦЭВЭРШИНЭ → ХОТ РУУ ХҮРНЭ → ХҮМҮҮС ХЭРЭГЛЭНЭ → БОХИР УС БУЦНА → БИД ЦЭВЭРШҮҮЛНЭ → ДАХИН ЭХЭЛНЭ.**

## Ажиллуулах

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Stack

| Үүрэг | Сан |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Scroll-based cinematic animation | GSAP + ScrollTrigger |
| Smooth scroll | Lenis |
| 3D / WebGL усны гадаргуу | Three.js + React Three Fiber (custom shader) |
| Усны шугам, map, процессын диаграм | SVG animation |
| Card, modal, UI transition | Framer Motion |
| Style | Tailwind CSS v4 |

## Бүтэц

```
app/                     layout, page, global styles
components/
  SmoothScroll.tsx       Lenis ↔ ScrollTrigger синк
  Navbar.tsx             desktop цэс + mobile ☰
  OutageBanner.tsx       "ОДОО: ус тасалдсан" мэдэгдэл
  three/WaterSurface.tsx Hero-ийн WebGL усны shader (mouse ripple, гэрэл, zoom)
  sections/
    Hero.tsx             01 УС БҮХНИЙ ЭХЛЭЛ
    WaterJourney.tsx     02 УСНЫ АЯЛАЛ (6 үе шат, sticky progress rail)
    journey/Visuals.tsx  үе шат бүрийн scroll-scrub SVG animation
    Services.tsx         03 Бидний үйл ажиллагаа
    WaterQuality.tsx     04 Усны чанар (counter + интерактив үзүүлэлт)
    CityMap.tsx          05 Дархан хотын интерактив схем + засварын цэг
    Projects.tsx         06 Төсөл (progress + detail modal)
    News.tsx             07 Мэдээ (шүүлтүүр)
    CustomerServices.tsx Хэрэглэгчийн үйлчилгээ + онлайн хүсэлт
    Contact.tsx          08 Холбоо барих + footer долгион
lib/content.ts           БҮХ агуулга нэг дор
```

## Агуулга шинэчлэх

Бүх текст, тоо, газрын зургийн цэг, төсөл, мэдээ `lib/content.ts` файлд байна.
`// TODO` гэж тэмдэглэсэн утгуудыг (хүчин чадал, утас, шинжилгээний тоо г.м.) байгууллагын бодит мэдээллээр солино.
`outages` массивыг хоослоход ус тасалдлын banner болон map дээрх улаан цэг алга болно.

## Дараагийн алхам

- Онлайн хүсэлтийн форм, төлбөр шалгахыг backend API-тай холбох (`CustomerServices.tsx` дахь `TODO`)
- Мэдээ, засвар, усны чанарын өгөгдлийг CMS / API-аас татах
- Төслийн бодит зураг нэмэх

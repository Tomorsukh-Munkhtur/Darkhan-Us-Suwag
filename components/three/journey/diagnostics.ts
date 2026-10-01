/**
 * WebGL context-ийн тоолуур (лабын оношилгоо).
 * created — R3F onCreated дуудагдсан тоо (= үүссэн WebGL context). Идэвхтэй карт солигдоход өсөх ёсгүй.
 * lost — webglcontextlost үйл явдал (GPU reset, эсвэл unmount-ын үеийн forceContextLoss).
 * Одоо байгаа context-ийн тоог document.querySelectorAll("canvas")-аар шалгана
 * (React Strict Mode dev-д effect-ийн хуурамч unmount-ыг тоолохгүйн тулд cleanup ашиглахгүй).
 */
export const contextCounter = { created: 0, lost: 0 };

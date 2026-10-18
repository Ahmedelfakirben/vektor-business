import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function cleanEmptyStrings<T extends object>(obj: T): T {
  const newObj = { ...obj } as any
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === "") {
      newObj[key] = null
    }
  })
  return newObj
}

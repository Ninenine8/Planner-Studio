export interface Sticker {
  id: string;
  url: string; // Blob URL
  width: number;
  height: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  x: number; // Percentage relative to day cell
  y: number; // Percentage relative to day cell
  scale: number;
  rotation: number;
}

export interface CalendarEvent {
  day: number;
  stickers: PlacedSticker[];
  note?: string;
}

export interface PlannerData {
  palette: string[];
  mood: string;
  monthlyQuotes: string[];
  font?: string;
  backgroundImage?: string;
  noteColor?: string;
  country?: string;
}

export interface MonthData {
  name: string;
  days: number;
  startDay: number; // 0 = Sunday
}

export const MONTHS_2026: MonthData[] = [
  { name: "January", days: 31, startDay: 4 },
  { name: "February", days: 28, startDay: 0 },
  { name: "March", days: 31, startDay: 0 },
  { name: "April", days: 30, startDay: 3 },
  { name: "May", days: 31, startDay: 5 },
  { name: "June", days: 30, startDay: 1 },
  { name: "July", days: 31, startDay: 3 },
  { name: "August", days: 31, startDay: 6 },
  { name: "September", days: 30, startDay: 2 },
  { name: "October", days: 31, startDay: 4 },
  { name: "November", days: 30, startDay: 0 },
  { name: "December", days: 31, startDay: 2 },
];
export const SUPPORTED_COUNTRIES = [
  { code: 'NONE', name: 'None' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'CN', name: 'China' },
  { code: 'US', name: 'United States' },
  { code: 'UK', name: 'United Kingdom' },
];

// Format: "MonthIndex-Day": "Holiday Name" (Month is 0-indexed: Jan=0, Dec=11)
export const HOLIDAYS_2026: Record<string, Record<string, string>> = {
  SG: {
    "0-1": "New Year's Day",
    "1-17": "Chinese New Year",
    "1-18": "Chinese New Year",
    "2-20": "Hari Raya Puasa",
    "3-3": "Good Friday",
    "4-1": "Labour Day",
    "4-27": "Hari Raya Haji",
    "4-31": "Vesak Day",
    "7-9": "National Day",
    "10-8": "Deepavali",
    "11-25": "Christmas Day"
  },
  MY: {
    "0-1": "New Year's Day",
    "1-1": "Federal Territory Day",
    "1-17": "Chinese New Year",
    "1-18": "Chinese New Year",
    "2-20": "Hari Raya Aidilfitri",
    "2-21": "Hari Raya Aidilfitri",
    "4-1": "Labour Day",
    "4-27": "Hari Raya Haji",
    "4-31": "Wesak Day",
    "5-1": "Agong's Birthday",
    "6-19": "Awal Muharram",
    "7-31": "Merdeka Day",
    "8-16": "Malaysia Day",
    "10-8": "Deepavali",
    "11-25": "Christmas Day"
  },
  US: {
    "0-1": "New Year's Day",
    "0-19": "Martin Luther King Jr. Day",
    "1-16": "Presidents' Day",
    "4-25": "Memorial Day",
    "5-19": "Juneteenth",
    "6-4": "Independence Day",
    "8-7": "Labor Day",
    "9-12": "Columbus Day",
    "10-11": "Veterans Day",
    "10-26": "Thanksgiving Day",
    "11-25": "Christmas Day"
  },
  UK: {
    "0-1": "New Year's Day",
    "3-3": "Good Friday",
    "3-6": "Easter Monday",
    "4-4": "Early May Bank Holiday",
    "4-25": "Spring Bank Holiday",
    "7-31": "Summer Bank Holiday",
    "11-25": "Christmas Day",
    "11-26": "Boxing Day"
  },
  CN: {
    "0-1": "New Year's Day",
    "1-17": "Spring Festival",
    "1-18": "Spring Festival",
    "1-19": "Spring Festival",
    "3-5": "Tomb Sweeping Day",
    "4-1": "Labour Day",
    "5-19": "Dragon Boat Festival",
    "8-25": "Mid-Autumn Festival",
    "9-1": "National Day",
    "9-2": "National Day",
    "9-3": "National Day"
  }
};

export const getHolidaysForMonth = (countryCode: string | undefined, monthIndex: number): Record<number, string> => {
  if (!countryCode || countryCode === 'NONE' || !HOLIDAYS_2026[countryCode]) {
    return {};
  }

  const holidays: Record<number, string> = {};
  const countryHolidays = HOLIDAYS_2026[countryCode];
  
  // Filter for current month keys (e.g., "0-1" matches monthIndex 0)
  Object.keys(countryHolidays).forEach(key => {
    const [m, d] = key.split('-');
    if (parseInt(m) === monthIndex) {
      holidays[parseInt(d)] = countryHolidays[key];
    }
  });

  return holidays;
};

import type { EpgProgram } from '@/types';

// Function to parse XMLTV time format (YYYYMMDDHHMMSS +ZZZZ) into a Date object
function parseXmlTvDate(dateTimeString: string): Date | null {
  const match = dateTimeString.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, offset] = match;
  
  const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  // Adjust for offset
  const offsetHours = parseInt(offset.substring(1, 3), 10) * (offset[0] === '+' ? 1 : -1);
  const offsetMinutes = parseInt(offset.substring(3, 5), 10) * (offset[0] === '+' ? 1 : -1);
  
  const utcDate = new Date(dateStr + 'Z'); // Treat as UTC first
  
  // Apply the offset to get the correct local time according to the EPG's timezone
  // then effectively convert it back to a UTC timestamp that represents that local time.
  // Date objects in JS inherently store time as UTC milliseconds since epoch.
  // By subtracting the offset, we are finding the equivalent UTC time.
  utcDate.setUTCHours(utcDate.getUTCHours() - offsetHours);
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() - offsetMinutes);
  
  return utcDate;
}


export function parseXMLTV(xmlString: string): Record<string, EpgProgram[]> {
  const epgData: Record<string, EpgProgram[]> = {};
  if (typeof window === 'undefined' || !xmlString) {
    return epgData; // Cannot use DOMParser in Node.js environment without polyfill
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        console.error("XMLTV Parsing Error:", errorNode.textContent);
        throw new Error("Failed to parse XMLTV data. Malformed XML.");
    }
    
    const programs = xmlDoc.getElementsByTagName("programme");

    for (let i = 0; i < programs.length; i++) {
      const programNode = programs[i];
      const channelId = programNode.getAttribute("channel");
      const startStr = programNode.getAttribute("start");
      const stopStr = programNode.getAttribute("stop");

      const titleNode = programNode.getElementsByTagName("title")[0];
      const descNode = programNode.getElementsByTagName("desc")[0];

      if (channelId && startStr && stopStr && titleNode) {
        const start = parseXmlTvDate(startStr);
        const end = parseXmlTvDate(stopStr);
        const title = titleNode.textContent || "Untitled Program";
        const description = descNode?.textContent || undefined;

        if (start && end) {
          if (!epgData[channelId]) {
            epgData[channelId] = [];
          }
          epgData[channelId].push({
            channelId,
            title,
            description,
            start,
            end,
          });
        }
      }
    }

    // Sort programs by start time for each channel
    for (const channel in epgData) {
      epgData[channel].sort((a, b) => a.start.getTime() - b.start.getTime());
    }

  } catch (error) {
    console.error("Error parsing XMLTV:", error);
    // Optionally re-throw or handle appropriately
    throw error; // Re-throw to be caught by the store
  }
  
  return epgData;
}

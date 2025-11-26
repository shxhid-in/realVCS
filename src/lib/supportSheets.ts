import { getGoogleSheetsClient } from './sheets';

// Support requests will be stored in a dedicated Google Sheet
const SUPPORT_SHEET_ID = process.env.SUPPORT_SHEET_ID || process.env.BUTCHER_POS_SHEET_ID;
const SUPPORT_TAB_NAME = 'Support_Requests';

// Fallback in-memory storage for development/testing
let fallbackSupportRequests: SupportRequest[] = [];

export interface SupportRequest {
  id: string;
  butcherId: string;
  butcherName: string;
  message: string | null;
  packingRequests: string[] | null; // Array of selected pack sizes (e.g., ["0.5kg", "1kg"])
  timestamp: string;
  type: 'general_contact' | 'packing_request';
  status: 'pending' | 'resolved';
  adminResponse: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const saveSupportRequest = async (request: Omit<SupportRequest, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullRequest: SupportRequest = {
      ...request,
      id: requestId,
      createdAt: new Date().toISOString()
    };

    if (!SUPPORT_SHEET_ID) {
      // Use fallback storage
      fallbackSupportRequests.push(fullRequest);
      return requestId;
    }

    const sheets = await getGoogleSheetsClient();
    
    const row = [
      requestId,
      request.butcherId,
      request.butcherName,
      request.message || '',
      request.packingRequests ? JSON.stringify(request.packingRequests) : '',
      request.timestamp,
      request.type,
      request.status,
      request.adminResponse || '',
      new Date().toISOString()
    ];

    // Check if tab exists, create if not
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SUPPORT_SHEET_ID,
        range: `${SUPPORT_TAB_NAME}!A1:J1`,
      });
    } catch (error) {
      // Tab doesn't exist, create it with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SUPPORT_SHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: SUPPORT_TAB_NAME
              }
            }
          }]
        }
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SUPPORT_SHEET_ID,
        range: `${SUPPORT_TAB_NAME}!A1:J1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'ID', 'Butcher ID', 'Butcher Name', 'Message', 'Packing Requests', 
            'Timestamp', 'Type', 'Status', 'Admin Response', 'Created At'
          ]]
        }
      });
    }

    // Add the request
    await sheets.spreadsheets.values.append({
      spreadsheetId: SUPPORT_SHEET_ID,
      range: `${SUPPORT_TAB_NAME}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });

    return requestId;
  } catch (error: any) {
    console.error('Error saving support request to Google Sheets, using fallback:', error);
    // Use fallback storage
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullRequest: SupportRequest = {
      ...request,
      id: requestId,
      createdAt: new Date().toISOString()
    };
    fallbackSupportRequests.push(fullRequest);
    return requestId;
  }
};

export const getSupportRequests = async (butcherId?: string): Promise<SupportRequest[]> => {
  try {
    if (!SUPPORT_SHEET_ID) {
      // Use fallback storage
      let requests = fallbackSupportRequests;
      if (butcherId) {
        requests = requests.filter(req => req.butcherId === butcherId);
      }
      return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const sheets = await getGoogleSheetsClient();
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SUPPORT_SHEET_ID,
        range: `${SUPPORT_TAB_NAME}!A2:J`,
      });

      const rows = response.data.values || [];
      const requests: SupportRequest[] = [];

      for (const row of rows) {
        if (row.length < 10) continue;

        const [id, butcherIdValue, butcherName, message, packingRequestsStr, timestamp, type, status, adminResponse, createdAt] = row;

        // Filter by butcherId if provided
        if (butcherId && butcherIdValue !== butcherId) continue;

        let packingRequests = null;
        if (packingRequestsStr) {
          try {
            const parsed = JSON.parse(packingRequestsStr);
            // Only accept array format (tick mark format)
            if (Array.isArray(parsed)) {
              packingRequests = parsed;
            } else {
              // If old format (object), convert to empty array (ignore old format)
              packingRequests = null;
            }
          } catch (e) {
            // If parsing fails, try to parse as comma-separated string (fallback)
            if (packingRequestsStr.includes(',')) {
              packingRequests = packingRequestsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
        }

        requests.push({
          id,
          butcherId: butcherIdValue,
          butcherName,
          message: message || null,
          packingRequests,
          timestamp,
          type: type as 'general_contact' | 'packing_request',
          status: status as 'pending' | 'resolved',
          adminResponse: adminResponse || null,
          createdAt,
          updatedAt: row[10] || undefined
        });
      }

      // Sort by creation date (newest first)
      requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return requests;
    } catch (error) {
      // Tab doesn't exist yet, return empty array
      return [];
    }
  } catch (error: any) {
    console.error('Error fetching support requests from Google Sheets, using fallback:', error);
    // Use fallback storage
    let requests = fallbackSupportRequests;
    if (butcherId) {
      requests = requests.filter(req => req.butcherId === butcherId);
    }
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};

export const updateSupportRequest = async (requestId: string, updates: Partial<SupportRequest>): Promise<void> => {
  try {
    if (!SUPPORT_SHEET_ID) {
      // Use fallback storage
      const index = fallbackSupportRequests.findIndex(req => req.id === requestId);
      if (index !== -1) {
        fallbackSupportRequests[index] = {
          ...fallbackSupportRequests[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return;
    }

    const sheets = await getGoogleSheetsClient();
    
    // Get all requests to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SUPPORT_SHEET_ID,
      range: `${SUPPORT_TAB_NAME}!A2:J`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === requestId) {
        rowIndex = i + 2; // +2 because we start from row 2 and arrays are 0-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Support request not found');
    }

    // Update specific columns
    const updatesToApply: { [key: string]: any } = {};
    
    if (updates.status !== undefined) {
      updatesToApply[`H${rowIndex}`] = updates.status;
    }
    
    if (updates.adminResponse !== undefined) {
      updatesToApply[`I${rowIndex}`] = updates.adminResponse;
    }

    // Add updatedAt timestamp
    updatesToApply[`J${rowIndex}`] = new Date().toISOString();

    // Apply updates
    for (const [cell, value] of Object.entries(updatesToApply)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SUPPORT_SHEET_ID,
        range: `${SUPPORT_TAB_NAME}!${cell}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[value]]
        }
      });
    }
  } catch (error: any) {
    console.error('Error updating support request in Google Sheets, using fallback:', error);
    // Use fallback storage
    const index = fallbackSupportRequests.findIndex(req => req.id === requestId);
    if (index !== -1) {
      fallbackSupportRequests[index] = {
        ...fallbackSupportRequests[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
  }
};

export const deleteSupportRequest = async (requestId: string): Promise<void> => {
  try {
    if (!SUPPORT_SHEET_ID) {
      // Use fallback storage
      fallbackSupportRequests = fallbackSupportRequests.filter(req => req.id !== requestId);
      return;
    }

    const sheets = await getGoogleSheetsClient();
    
    // First, get the spreadsheet to find the correct sheet name
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SUPPORT_SHEET_ID,
    });
    
    // Try to find the support sheet with different possible names
    const possibleNames = [SUPPORT_TAB_NAME, 'Support Requests', 'Support', 'support_requests'];
    const supportSheet = spreadsheet.data.sheets?.find(sheet => 
      possibleNames.includes(sheet.properties?.title || '')
    );
    
    if (!supportSheet?.properties?.title) {
      throw new Error('Support sheet not found');
    }
    
    const actualSheetName = supportSheet.properties.title;
    
    // Get all requests to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SUPPORT_SHEET_ID,
      range: `${actualSheetName}!A2:J`,
    });

    const rows = response.data.values || [];
    
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[0] === requestId) {
        rowIndex = i + 2; // +2 because we start from row 2 and arrays are 0-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Support request not found');
    }

    // Use the support sheet we already found
    if (!supportSheet?.properties?.sheetId) {
      throw new Error('Support sheet ID not found');
    }

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SUPPORT_SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: supportSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });
    
    console.log(`[Contact] Support request deleted: ${requestId}`);
  } catch (error: any) {
    console.error('[Contact] Error deleting support request:', error);
    // Use fallback storage
    fallbackSupportRequests = fallbackSupportRequests.filter(req => req.id !== requestId);
  }
};

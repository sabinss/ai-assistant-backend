const axios = require('axios');
const https = require('https'); // Add this line
const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT,
  headers: {
    'X-API-KEY': process.env.NEXT_PUBLIC_OPEN_API_KEY_FOR_CHAT,
  },
  // Disable certificate verification (NOT RECOMMENDED FOR PRODUCTION)
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

http.sendMessage = async (companyId, query, sessionId) => {
  const url = `/assistant/ask`;
  const params = {
    company_id: companyId,
    query: encodeURIComponent(query),
    session_id: sessionId,
  };
  const headers = {
    accept: 'application/json',
  };
  console.log('444', url);
  try {
    const response = await http.get(url, {params, headers});
    return response?.data;
  } catch (error) {
    console.log('555');
    // console.error(error);
    throw error;
  }
};
http.pdfUpload = async (companyId, files) => {
  const url = `/assistant/upload-pdfs`;
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const headers = {
    accept: 'application/json',
    'Content-Type': 'multipart/form-data',
  };
  const params = {
    company_id: companyId,
  };
  try {
    const response = await http.post(url, formData, {headers, params});
    return response?.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

http.getPdfList = async (
  companyId,
  page,
  search,
  sortColumn,
  sortOrder,
  limit
) => {
  const headers = {
    accept: 'application/json',
  };
  const params = {
    company_id: companyId || 0,
    page: page || 1,
    search: search || '',
    sortField: sortColumn || '',
    sortDirection: sortOrder || '',
    limit: limit || 10,
  };
  const url = `/get-pdfs-list?company_id=${params.company_id}&page=${params.page}&search=${params.search}&sortField=${params.sortField}&sortDirection=${params.sortDirection}&limit=${params.limit}`;
  try {
    const response = await http.get(url, {headers});
    return response?.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

http.sendFeedback = async (feedback_id, company_id, feedback) => {
  const url = `/assistant/save-feedback?feedback_id=${feedback_id}&company_id=${company_id}&feedback=${feedback}`;
  const headers = {
    accept: 'application/json',
  };
  try {
    const response = await http.post(url, null, {headers});
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

http.deleteFeedback = async (company_id, feedback_ids) => {
  const url = `/assistant/delete-feedbacks?company_id=${company_id}&feedback_ids=${feedback_ids.join(
    '&feedback_ids='
  )}`;
  console.log('deleting url is ', url);
  const headers = {
    accept: 'application/json',
  };
  try {
    const response = await http.delete(url, {headers});
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

http.deletePdf = async (company_id, file_names) => {
  const url = `/assistant/delete-pdfs?company_id=${company_id}&file_names=${file_names.join(
    '&file_names='
  )}`;
  const headers = {
    accept: 'application/json',
  };
  try {
    const response = await http.delete(url, {headers});
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

module.exports = http;

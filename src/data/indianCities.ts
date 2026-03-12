// Comprehensive Indian cities list for autocomplete
export const INDIAN_CITIES: string[] = [
  // Metro Cities
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  // Tier 1
  'Jaipur', 'Lucknow', 'Chandigarh', 'Indore', 'Bhopal', 'Nagpur', 'Patna', 'Coimbatore',
  'Kochi', 'Thiruvananthapuram', 'Visakhapatnam', 'Vadodara', 'Surat', 'Rajkot',
  'Gurgaon', 'Noida', 'Ghaziabad', 'Faridabad', 'Greater Noida',
  // Tier 2
  'Dehradun', 'Ranchi', 'Bhubaneswar', 'Raipur', 'Mysore', 'Mangalore', 'Hubli',
  'Belgaum', 'Guwahati', 'Shillong', 'Imphal', 'Agartala', 'Aizawl', 'Kohima',
  'Itanagar', 'Gangtok', 'Shimla', 'Dharamshala', 'Jammu', 'Srinagar',
  'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala', 'Bathinda',
  'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar',
  'Agra', 'Varanasi', 'Kanpur', 'Allahabad', 'Meerut', 'Bareilly', 'Aligarh', 'Moradabad',
  'Gorakhpur', 'Mathura', 'Firozabad', 'Saharanpur', 'Muzaffarnagar',
  'Aurangabad', 'Nashik', 'Solapur', 'Kolhapur', 'Thane', 'Navi Mumbai', 'Kalyan',
  'Dombivli', 'Vasai-Virar', 'Panvel', 'Sangli', 'Satara', 'Ratnagiri',
  'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi',
  'Tiruppur', 'Dindigul', 'Thanjavur', 'Nagercoil',
  'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada',
  'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Mahbubnagar',
  'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribag', 'Deoghar',
  'Cuttack', 'Berhampur', 'Sambalpur', 'Rourkela',
  'Bilaspur', 'Durg', 'Bhilai', 'Korba', 'Jagdalpur',
  'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Satna', 'Rewa',
  // Tier 3
  'Panaji', 'Margao', 'Vasco da Gama',
  'Puducherry', 'Karaikal',
  'Silvassa', 'Daman', 'Diu',
  'Port Blair',
  'Leh', 'Kargil',
  // Delhi NCR specific
  'Delhi-NCR', 'New Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'North Delhi',
  // Work from Home / Remote
  'Work From Home', 'Remote', 'Pan India', 'Anywhere in India',
];

// Search cities with minimum character threshold
export function searchCities(query: string, minChars = 3): string[] {
  if (!query || query.length < minChars) return [];
  const lower = query.toLowerCase();
  return INDIAN_CITIES
    .filter(city => city.toLowerCase().includes(lower))
    .sort((a, b) => {
      // Exact start match first
      const aStarts = a.toLowerCase().startsWith(lower);
      const bStarts = b.toLowerCase().startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 15);
}

// Indian states for dropdown
export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Scratch script to verify the fix for formatDateTimeLocalized
const { formatDateTimeLocalized } = require('./src/lib/dateUtils');

// Mock lang and options
const lang = 'ru';
const options = { dateStyle: 'medium', timeStyle: 'short' };
const date = new Date('2026-04-08T15:56:02');

try {
    const result = formatDateTimeLocalized(date, lang, options);
    console.log('Success:', result);
    
    const enResult = formatDateTimeLocalized(date, 'en', options);
    console.log('Success (en):', enResult);

    const defaultResult = formatDateTimeLocalized(date, 'ru');
    console.log('Default (ru):', defaultResult);
} catch (e) {
    console.error('Failed:', e.message);
}

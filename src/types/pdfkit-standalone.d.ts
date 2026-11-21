// src/types/pdfkit-standalone.d.ts
//
// @types/pdfkit only declares the 'pdfkit' module path. We import from
// 'pdfkit/js/pdfkit.standalone.js' instead (see pdfReport.ts for why), so TS
// needs to be told that path has the exact same shape as the main module.
declare module 'pdfkit/js/pdfkit.standalone.js' {
  import PDFDocument from 'pdfkit'
  export default PDFDocument
}

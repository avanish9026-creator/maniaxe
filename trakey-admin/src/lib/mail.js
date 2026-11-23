// Email without a mail server: opens the person's own Gmail / mail app with everything filled in.
export const gmailLink = ({ to = "", bcc = "", subject = "", body = "" }) =>
  "https://mail.google.com/mail/?view=cm&fs=1" +
  (to ? "&to=" + encodeURIComponent(to) : "") +
  (bcc ? "&bcc=" + encodeURIComponent(bcc) : "") +
  "&su=" + encodeURIComponent(subject) +
  "&body=" + encodeURIComponent(body);

export const mailtoLink = ({ to = "", bcc = "", subject = "", body = "" }) =>
  "mailto:" + encodeURIComponent(to).replace(/%40/g, "@").replace(/%2C/g, ",") +
  "?subject=" + encodeURIComponent(subject) +
  (bcc ? "&bcc=" + encodeURIComponent(bcc) : "") +
  "&body=" + encodeURIComponent(body);


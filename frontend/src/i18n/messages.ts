import type { Language } from './language';

/**
 * Messages that come from the server or from sign-in are written in
 * English. In the Indonesian interface the known ones are shown in
 * Indonesian; anything unknown is shown as it came.
 */
const INDONESIAN: Record<string, string> = {
  // Sign-in, sign-up, codes, passwords
  'We could not create the account. This student number may already be registered.':
    'Akun tidak dapat dibuat. NIM ini mungkin sudah terdaftar.',
  'Too many attempts in a short time. Please wait a few minutes and try again.':
    'Terlalu banyak percobaan dalam waktu singkat. Tunggu beberapa menit lalu coba lagi.',
  'An account with this email already exists. Try signing in instead.':
    'Sudah ada akun dengan email ini. Coba masuk saja.',
  'We could not create the account. Please try again.':
    'Akun tidak dapat dibuat. Silakan coba lagi.',
  'This code is not correct or has expired. Check the newest email, or send a new code.':
    'Kode ini salah atau sudah kedaluwarsa. Periksa email terbaru, atau kirim kode baru.',
  'We could not check the code. Please try again.':
    'Kami tidak dapat memeriksa kode. Silakan coba lagi.',
  'Please wait a little before asking for another code.':
    'Tunggu sebentar sebelum meminta kode lain.',
  'We could not send a new code. Please try again.':
    'Kami tidak dapat mengirim kode baru. Silakan coba lagi.',
  'Your session has ended. Please sign in again.':
    'Sesimu sudah berakhir. Silakan masuk lagi.',
  'Your current password is not correct.': 'Kata sandi saat ini tidak benar.',
  'We could not check your current password. Please try again.':
    'Kami tidak dapat memeriksa kata sandimu saat ini. Silakan coba lagi.',
  'We could not change your password. Please try again.':
    'Kami tidak dapat mengganti kata sandimu. Silakan coba lagi.',
  'Choose a password of at least 8 characters.':
    'Pilih kata sandi minimal 8 karakter.',
  'We could not send the code. Please try again.':
    'Kami tidak dapat mengirim kode. Silakan coba lagi.',
  // Server
  'Could not reach the server. Please try again.':
    'Tidak dapat terhubung ke server. Silakan coba lagi.',
  'Something went wrong. Please try again.': 'Terjadi kesalahan. Silakan coba lagi.',
  'Connect to your Academic Advisor before starting a screening.':
    'Hubungkan ke Dosen Pembimbing Akademikmu sebelum memulai skrining.',
  'Could not check your Academic Advisor. Please try again.':
    'Tidak dapat memeriksa Dosen Pembimbing Akademikmu. Silakan coba lagi.',
  'Could not save the screening. Please try again.':
    'Skrining tidak dapat disimpan. Silakan coba lagi.',
  'The Support Chat is not available right now. Please try again later.':
    'Layanan Obrolan sedang tidak tersedia. Silakan coba lagi nanti.',
  'Write a message first.': 'Tulis pesan terlebih dahulu.',
  'No Academic Advisor was found for this code. Check it with your advisor.':
    'Tidak ada Dosen Pembimbing Akademik dengan kode ini. Periksa kembali dengan dosenmu.',
  'That does not look like an advisor code. Codes have 8 characters, like AB2C-9KMP.':
    'Itu tidak terlihat seperti kode dosen. Kode terdiri dari 8 karakter, misalnya AB2C-9KMP.',
  'Enter your full name.': 'Masukkan nama lengkapmu.',
  'Enter your student number (NIM) using 5 to 20 digits.':
    'Masukkan NIM dengan 5 sampai 20 angka.',
  'Enter your class, for example TI 6A.': 'Masukkan kelasmu, misalnya TI 6A.',
  'This student number is already used by another account.':
    'NIM ini sudah dipakai akun lain.',
  'Screening not found.': 'Skrining tidak ditemukan.',
};

export function translateMessage(message: string, language: Language): string {
  return language === 'id' ? (INDONESIAN[message] ?? message) : message;
}

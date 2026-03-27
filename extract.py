import PyPDF2
import sys

def extract_pdf(pdf_path, txt_path):
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n\n"
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print("Done")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    extract_pdf("かね将ポータル仕様書.pdf", "spec_extracted.txt")

from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import base64

app = Flask(__name__)

def process_floor_plan(image_data):
    # 1. Base64 veriyi çöz
    encoded_data = image_data.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 2. Gri Tona Çevir ve Gürültü Azalt
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # 3. Adaptive Threshold (Aydınlatma farklarını tolere eder)
    # Beyaz kağıt üzerindeki siyah çizgileri daha iyi yakalar
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY_INV, 11, 2)
    
    # 4. Morfolojik İşlemler (KRİTİK ADIM)
    # Açık kapıları kapatmak ve kesik çizgileri birleştirmek için
    # Kernel boyutu (5,5) -> Yaklaşık 5 piksellik boşlukları kapatır.
    # Kapı açıklıkları büyükse bu değer (7,7) veya (9,9) yapılabilir.
    kernel = np.ones((5,5), np.uint8)
    closing = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # 5. Konturları Bul
    contours, _ = cv2.findContours(closing, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    found_rooms = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        
        # Filtreleme: Çok küçük (gürültü) ve çok büyük (dış çerçeve) alanları at
        if 1000 < area < 1000000: 
            # Konturu basitleştir (Düz duvarlar elde etmek için)
            epsilon = 0.005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Koordinatları listeye çevir
            points = approx.reshape(-1, 2).tolist()
            
            found_rooms.append({
                "points": points,
                "area_px": area,
                "perimeter_px": cv2.arcLength(cnt, True)
            })
            
    return found_rooms

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        image_data = data['image']
        rooms = process_floor_plan(image_data)
        return jsonify({"status": "success", "rooms": rooms})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
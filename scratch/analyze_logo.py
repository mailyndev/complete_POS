import os
from PIL import Image
from collections import Counter

logo_path = "uploads/empresa/logo.jpg"

if not os.path.exists(logo_path):
    print(f"Error: Logo file not found at {logo_path}")
    # Fallback default path in case of absolute path differences
    logo_path = os.path.abspath(logo_path)
    print(f"Absolute path checked: {logo_path}")

if os.path.exists(logo_path):
    try:
        img = Image.open(logo_path)
        img = img.resize((150, 150)) # Redimensionar para acelerar
        img_rgb = img.convert('RGB')
        pixels = list(img_rgb.getdata())
        
        # Filtrar colores muy blancos o muy negros
        filtered_pixels = []
        for r, g, b in pixels:
            # Si no es demasiado blanco (ej. > 240) ni demasiado negro (ej. < 15)
            if not (r > 240 and g > 240 and b > 240) and not (r < 15 and g < 15 and b < 15):
                filtered_pixels.append((r, g, b))
                
        if not filtered_pixels:
            filtered_pixels = pixels
            
        color_counts = Counter(filtered_pixels)
        most_common = color_counts.most_common(10)
        
        print("DOMINANT_COLORS_FOUND:")
        for color, count in most_common:
            hex_color = '#{:02x}{:02x}{:02x}'.format(*color)
            print(f"- Hex: {hex_color}, RGB: {color}, Count: {count}")
    except Exception as e:
        print(f"Error analyzing image: {e}")
else:
    print("Logo file does not exist.")

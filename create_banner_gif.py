from PIL import Image

# Step 1: Load and resize the 3 images to banner size
bitcoin = Image.open("bitcoin.png").convert("RGB").resize((1628, 117))
usdt = Image.open("usdt.png").convert("RGB").resize((1628, 117))
swift = Image.open("swift.png").convert("RGB").resize((1628, 117))

# Step 2: Save as an animated GIF
bitcoin.save(
    "transfer_banner_slideshow.gif",
    save_all=True,
    append_images=[usdt, swift],
    duration=5000,  # 5 seconds per image
    loop=0
)


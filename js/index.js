// // Carousel functionality
const track = document.getElementById('carouselTrack');
const scrollAmount = 320; // Adjust to match your card width + gap

function scrollCarousel(direction) {
    const maxScrollLeft = track.scrollWidth - track.clientWidth;

    // If scrolling right and at (or near) the end
    if (direction === 1 && Math.ceil(track.scrollLeft) >= maxScrollLeft) {
        track.scrollTo({
            left: 0,
            behavior: 'smooth'
        });
    } 
    // If scrolling left and at (or near) the beginning
    else if (direction === -1 && track.scrollLeft <= 0) {
        track.scrollTo({
            left: maxScrollLeft,
            behavior: 'smooth'
        });
    } 
    // Otherwise just scroll normally
    else {
        track.scrollBy({
            left: scrollAmount * direction,
            behavior: 'smooth'
        });
    }
}

// Auto-scroll carousel every 4 seconds
setInterval(() => {
    scrollCarousel(1);
}, 3000);

// Scroll to top when up arrow is clicked
document.getElementById("upArrow").onclick = function () {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};


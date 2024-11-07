document.addEventListener("DOMContentLoaded", function() {
  const lastUpdated = new Date("2024-04-24");
  const dateString = lastUpdated.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
  });
  document.querySelector('.last-updated').textContent = `Website last updated on: ${dateString}.`;
});
document.querySelector('.btn-outline-success').addEventListener('click', function(e) {
  window.location.href = "/login";
});

async function predictDisease(imageFile) {
  let formData = new FormData();
  formData.append('file', imageFile);

  try {
      const response = await fetch('http://localhost:5000/disease-predict', {
          method: 'POST',
          body: formData
      });

      const result = await response.json();
      console.log(result);
      document.getElementById('prediction-result').innerText = result.prediction;
  } catch (error) {
      console.error('Error:', error);
  }
}

document.getElementById('upload-button').addEventListener('change', function(event) {
  const imageFile = event.target.files[0];
  predictDisease(imageFile);
});

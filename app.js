// Configura la conexión apuntando a la dirección de tu backend .NET
const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://gamebackend-ulvt.onrender.com"/gamehub) // Asegúrate de verificar el puerto de tu servidor
    .build();

// Escucha el evento que configuramos en C#
connection.on("UpdatePlayerCount", (count) => {
    document.getElementById("player-count").textContent = count;
});

document.getElementById("temp").textContent = "Funciona"
// Inicia la conexión en tiempo real
async function start() {
    try {
        await connection.start();
        console.log("¡Conectados a SignalR con éxito!");
    } catch (err) {
        console.error("Error al conectar:", err);
        setTimeout(start, 5000); // Intenta reconectar en 5 segundos si falla
    }
}

start();

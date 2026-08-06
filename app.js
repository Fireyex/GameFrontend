let connection = null;
let intervaloTimerVisual = null;
let miNombreUsuario = "";
let votosSeleccionados = [];
let hayGanadorDelJuego = false;
let estadoActualGlobal = "LOBBY"; // Para ayudar a renderizar la lista correctamente

const pantallas = {
    login: document.getElementById("pantalla-login"),
    lobby: document.getElementById("pantalla-lobby"),
    juego: document.getElementById("pantalla-juego"),
    votacion: document.getElementById("pantalla-votacion"),
    resultados: document.getElementById("pantalla-resultados")
};

document.getElementById("btn-entrar").addEventListener("click", async () => {
    miNombreUsuario = document.getElementById("input-nombre").value.trim();
    if (!miNombreUsuario) return alert("Ingresa un nombre válido.");

    // Cambia el puerto si tu backend corre en otro
    connection = new signalR.HubConnectionBuilder()
        .withUrl(`https://gamebackend-ulvt.onrender.com/gamehub?username=${encodeURIComponent(miNombreUsuario)}`) 
        .build();

    connection.on("ActualizarListaJugadores", (jugadores, estadoJuego) => {
        estadoActualGlobal = estadoJuego;
        const yo = jugadores.find(j => j.nombre === miNombreUsuario);
        const soyHost = yo ? yo.esHost : false;

        actualizarPermisosHostUI(soyHost);
        renderizarJugadores(jugadores, estadoJuego);
        cambiarPantallaSegunEstado(estadoJuego);
    });

    connection.on("ErrorPermiso", (mensaje) => alert(mensaje));

    connection.on("NuevaPregunta", (pregunta, tiempoSegundos) => {
        document.getElementById("texto-pregunta").textContent = pregunta;
        document.getElementById("input-respuesta").value = "";
        document.getElementById("seccion-respuesta").classList.remove("hidden");
        document.getElementById("mensaje-espera").classList.add("hidden");

        iniciarTimerVisual(tiempoSegundos, "contador-tiempo");
    });

    connection.on("IniciarVotacion", (respuestas, tiempoSegundos) => {
        votosSeleccionados = [];
        document.getElementById("btn-enviar-votos").classList.remove("hidden");
        document.getElementById("mensaje-espera-votos").classList.add("hidden");

        const contenedor = document.getElementById("lista-respuestas-votacion");
        contenedor.innerHTML = "";

        respuestas.forEach(r => {
            const div = document.createElement("div");
            div.style.cssText = "padding: 15px; border: 2px solid #ccc; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 18px;";
            div.innerHTML = `<strong>${r.nombre}</strong> escribió:<br><span style="font-size:22px;">${r.respuesta}</span>`;
            
            div.addEventListener("click", () => {
                const index = votosSeleccionados.indexOf(r.id);
                if (index > -1) {
                    votosSeleccionados.splice(index, 1);
                    div.style.backgroundColor = "";
                    div.style.borderColor = "#ccc";
                } else {
                    votosSeleccionados.push(r.id);
                    div.style.backgroundColor = "#d4edda";
                    div.style.borderColor = "#28a745";
                }
            });
            contenedor.appendChild(div);
        });

        iniciarTimerVisual(tiempoSegundos, "contador-tiempo-votacion");
    });

    connection.on("MostrarResultados", (resumen, ganadorJuego, hayEmpate) => {
        clearInterval(intervaloTimerVisual);
        
        const contenedor = document.getElementById("contenedor-resultados");
        contenedor.innerHTML = "";

        hayGanadorDelJuego = !!ganadorJuego;

        if (ganadorJuego) {
            const divGanador = document.createElement("div");
            divGanador.style.cssText = "background: #d4edda; border: 2px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-size: 18px; font-weight: bold;";
            divGanador.innerHTML = `🏆 ¡${ganadorJuego} HA GANADO EL JUEGO!`;
            contenedor.appendChild(divGanador);
        } else if (hayEmpate) {
            const divEmpate = document.createElement("div");
            divEmpate.style.cssText = "background: #fff3cd; border: 2px solid #ffeeba; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-size: 16px; font-weight: bold;";
            divEmpate.innerHTML = `⚔️ ¡EMPATE EN LA CIMA! <br><small style="font-weight: normal;">Ronda de desempate requerida.</small>`;
            contenedor.appendChild(divEmpate);
        }

        resumen.forEach(item => {
            const div = document.createElement("div");
            div.className = `result-item ${item.esGanadora ? 'winner' : 'loser'}`;
            div.innerHTML = `
                <span><strong>${item.nombre}:</strong> ${item.respuesta} (${item.votos} voto/s)</span>
                <span style="float: right;">${item.esGanadora ? '➕1 Punto' : '❌ Nada'}</span>
            `;
            contenedor.appendChild(div);
        });

        // Actualizar UI del Host tras mostrar resultados (por si hay ganador)
        const yo = document.getElementById("panel-host-config").classList.contains("hidden") === false;
        actualizarPermisosHostUI(yo); 
    });

    try {
        await connection.start();
        pantallas.login.classList.add("hidden");
    } catch (err) {
        console.error("Error conectando:", err);
    }
});

// Controles del Host
document.getElementById("btn-iniciar-ronda").addEventListener("click", () => enviarComandoRonda());
document.getElementById("btn-siguiente-ronda").addEventListener("click", () => enviarComandoRonda());

async function enviarComandoRonda() {
    const puntos = parseInt(document.getElementById("input-puntos-ganar").value) || 8;
    const tiempo = parseInt(document.getElementById("input-tiempo-ronda").value) || 30;
    try { await connection.invoke("IniciarSiguienteRonda", puntos, tiempo); } 
    catch (err) { console.error(err); }
}

document.getElementById("btn-volver-lobby").addEventListener("click", async () => {
    try { await connection.invoke("VolverAlLobby"); } catch (err) { console.error(err); }
});

// Interacciones del Jugador
document.getElementById("btn-enviar-respuesta").addEventListener("click", async () => {
    const respuesta = document.getElementById("input-respuesta").value.trim();
    if (!respuesta) return alert("Escribe una respuesta.");
    try {
        await connection.invoke("EnviarRespuesta", respuesta);
        document.getElementById("seccion-respuesta").classList.add("hidden");
        document.getElementById("mensaje-espera").classList.remove("hidden");
    } catch (err) { console.error(err); }
});

document.getElementById("btn-enviar-votos").addEventListener("click", async () => {
    try {
        await connection.invoke("EnviarVotos", votosSeleccionados);
        document.getElementById("btn-enviar-votos").classList.add("hidden");
        document.getElementById("mensaje-espera-votos").classList.remove("hidden");
    } catch (err) { console.error(err); }
});

// Funciones de UI
function actualizarPermisosHostUI(soyHost) {
    const panelHostConfig = document.getElementById("panel-host-config");
    const msjEsperaHostLobby = document.getElementById("mensaje-espera-host");
    const msjEsperaHostRes = document.getElementById("mensaje-espera-host-resultados");
    const btnIniciar = document.getElementById("btn-iniciar-ronda");
    const btnSiguiente = document.getElementById("btn-siguiente-ronda");
    const btnLobby = document.getElementById("btn-volver-lobby");

    if (soyHost) {
        panelHostConfig.classList.remove("hidden");
        msjEsperaHostLobby.classList.add("hidden");
        msjEsperaHostRes.classList.add("hidden");
        
        if (estadoActualGlobal === "LOBBY") {
            btnIniciar.classList.remove("hidden");
        } else if (estadoActualGlobal === "RESULTADOS") {
            if (hayGanadorDelJuego) {
                btnSiguiente.classList.add("hidden");
                btnLobby.classList.remove("hidden");
            } else {
                btnSiguiente.classList.remove("hidden");
                btnLobby.classList.add("hidden");
            }
        }
    } else {
        panelHostConfig.classList.add("hidden");
        btnIniciar.classList.add("hidden");
        btnSiguiente.classList.add("hidden");
        btnLobby.classList.add("hidden");

        if (estadoActualGlobal === "LOBBY") msjEsperaHostLobby.classList.remove("hidden");
        if (estadoActualGlobal === "RESULTADOS") msjEsperaHostRes.classList.remove("hidden");
    }
}

function iniciarTimerVisual(segundos, elementId) {
    clearInterval(intervaloTimerVisual);
    let restante = segundos;
    const spanTiempo = document.getElementById(elementId);
    spanTiempo.textContent = restante;

    intervaloTimerVisual = setInterval(() => {
        restante--;
        spanTiempo.textContent = restante;
        if (restante <= 0) clearInterval(intervaloTimerVisual);
    }, 1000);
}

function cambiarPantallaSegunEstado(estado) {
    Object.values(pantallas).forEach(p => p.classList.add("hidden"));
    
    // login se oculta desde el click inicial.
    if (estado === "LOBBY") pantallas.lobby.classList.remove("hidden");
    if (estado === "JUGANDO") pantallas.juego.classList.remove("hidden");
    if (estado === "VOTACION") pantallas.votacion.classList.remove("hidden");
    if (estado === "RESULTADOS") pantallas.resultados.classList.remove("hidden");
}

function renderizarJugadores(jugadores, estadoJuego) {
    const listas = [
        document.getElementById("lista-jugadores-lobby"),
        document.getElementById("lista-jugadores-juego"),
        document.getElementById("lista-tabla-posiciones")
    ];

    listas.forEach(ul => {
        if (!ul) return;
        ul.innerHTML = "";

        jugadores.forEach(j => {
            const li = document.createElement("li");
            li.className = `player-item ${j.tieneVacaRosa ? 'pink-cow' : ''}`;
            const vacaIcono = j.tieneVacaRosa ? '🐮 (Vaca Rosa)' : '';
            const coronaHost = j.esHost ? '👑 ' : '';
            
            // Determinamos el estado del jugador dependiendo de la fase
            let estadoTexto = '';
            if (estadoJuego === "JUGANDO") estadoTexto = j.yaRespondio ? '✅ Listo' : '✍️ Escribiendo...';
            else if (estadoJuego === "VOTACION") estadoTexto = j.yaVoto ? '✅ Votó' : '🤔 Leyendo...';

            li.innerHTML = `
                <div>
                    <strong>${coronaHost}${j.nombre}</strong> ${vacaIcono}
                    <br><small style="color:#666;">Puntos: ${j.puntos}</small>
                </div>
                ${estadoTexto ? `<span class="badge">${estadoTexto}</span>` : ''}
            `;
            ul.appendChild(li);
        });
    });
}
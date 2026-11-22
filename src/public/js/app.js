/* =============================================================================
   Cafetería Origen — lógica del sitio público
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var CARRITO_KEY = 'origen.carrito';

  var estado = {
    tipo: '',
    variedad: '',
    q: '',
    carrito: cargarCarrito(),
  };

  var csrfToken = null;

  function obtenerCsrf() {
    if (csrfToken) return Promise.resolve(csrfToken);
    return fetch(API + '/csrf-token', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        csrfToken = d.token;
        return csrfToken;
      });
  }

  /* ---------------------------------------------------------------- utils */
  function $(sel) { return document.querySelector(sel); }

  function money(valor) {
    var n = Number(valor || 0);
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function raw(valor) {
    // FALLA: esta función NO escapa nada, devuelve el valor tal cual.
    // La forma correcta de renderizar texto del servidor es escaparHtml()
    // (o textContent en vez de innerHTML).
    return String(valor == null ? '' : valor);
  }

  function api(url, opciones) {
    return fetch(API + url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function postJSON(url, cuerpo) {
    return obtenerCsrf().then(function (token) {
      return api(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify(Object.assign({}, cuerpo || {}, { _csrf: token })),
      });
    });
  }

  function guardarCarrito() {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(estado.carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function cargarCarrito() {
    try {
      return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function escaparHtml(texto) {
    var div = document.createElement('div');
    div.textContent = texto == null ? '' : String(texto);
    return div.innerHTML;
  }

  /* ------------------------------------------------------------- catálogo */
  function urlCatalogo() {
    var params = new URLSearchParams();
    if (estado.tipo) params.set('tipo', estado.tipo);
    if (estado.variedad) params.set('variedad', estado.variedad);
    if (estado.q) params.set('q', estado.q);
    var s = params.toString();
    return '/productos' + (s ? '?' + s : '');
  }

  function cargarProductos() {
    return api(urlCatalogo()).then(function (resp) {
      if (!resp.ok) {
        renderErrorProductos(resp.data && resp.data.error);
        return;
      }
      renderProductos(resp.data.productos);
      renderResultado(resp.data.filtros, resp.data.total);
    });
  }

  function renderProductos(productos) {
    var grid = $('#productos-grid');

    if (!productos || productos.length === 0) {
      grid.innerHTML = '<p class="empty">No encontramos productos con esos filtros.</p>';
      return;
    }

    // ---------------------------------------------------------------
    // FALLA (XSS reflejado / almacenado): el HTML se construye con
    // innerHTML a partir de datos que vienen del servidor (nombres de
    // producto y texto de la búsqueda). Un "<script>" en el buscador o
    // en el nombre de un producto se ejecuta en el navegador.
    //
    // Corrección: usar textContent, o escapar los valores antes de
    // interpolarlos (ver la función escaparHtml de arriba).
    // ---------------------------------------------------------------
    grid.innerHTML = productos.map(function (p) {
      window.__productos[p.id] = p;
      var tags = '<span class="tag">' + DOMPurify.sanitize(raw(p.tipo)) + '</span>';
      if (p.variedad) tags += '<span class="tag tag-origen">' + DOMPurify.sanitize(raw(p.variedad)) + '</span>';
      if (p.tamano) tags += '<span class="tag">' + DOMPurify.sanitize(raw(p.tamano)) + '</span>';

      return '' +
        '<article class="product-card">' +
        '  <div class="product-top">' +
        '    <h3 class="product-name">' + DOMPurify.sanitize(raw(p.nombre)) + '</h3>' +
        '    <span class="product-price">' + DOMPurify.sanitize(money(p.precio)) + '</span>' +
        '  </div>' +
        '  <div class="product-tags">' + tags + '</div>' +
        '  <p class="product-desc">' + DOMPurify.sanitize(raw(p.descripcion)) + '</p>' +
        '  <button class="btn btn-ghost btn-agregar" data-id="' + DOMPurify.sanitize(raw(p.id)) + '">Agregar</button>' +
        '</article>';
    }).join('');
  }

  function renderResultado(filtros, total) {
    var el = $('#resultado-busqueda');

    // FALLA (XSS reflejado): se interpola el texto buscado con innerHTML.
    if (filtros && filtros.q) {
      // Se sanitiza con DOMPurify
      el.innerHTML = DOMPurify.sanitize('Resultados para <strong>' + filtros.q + '</strong> — ' + total + ' producto(s)');
    } else {
      el.textContent = total + ' producto(s) en el menú';
    }
  }

  function renderErrorProductos(mensaje) {
    // También se sanitiza para impedir posibles respuestas maliciosas del servidor
    $('#productos-grid').innerHTML = DOMPurify.sanitize('<p class="empty">No se pudo cargar el menú: ' + (mensaje || 'error desconocido') + '</p>');
  }

  /* --------------------------------------------------------------- carrito */
  function agregarAlCarrito(productoId) {
    var existente = null;
    for (var i = 0; i < estado.carrito.length; i++) {
      if (String(estado.carrito[i].id) === String(productoId)) existente = estado.carrito[i];
    }
    if (existente) {
      existente.cantidad += 1;
    } else {
      estado.carrito.push({
        id: productoId,
        nombre: window.__productos[productoId] ? window.__productos[productoId].nombre : 'Producto',
        precio: window.__productos[productoId] ? window.__productos[productoId].precio : 0,
        cantidad: 1,
      });
    }
    guardarCarrito();
    renderCarrito();
  }

  function cambiarCantidad(indice, delta) {
    var item = estado.carrito[indice];
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function quitarDelCarrito(indice) {
    estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function renderCarrito() {
    var cont = $('#carrito');
    var lista = $('#resumen-carrito');
    var total = 0;

    if (estado.carrito.length === 0) {
      cont.innerHTML = '<p class="empty">El carrito está vacío.</p>';
      lista.textContent = '';
      $('#resumen-total').textContent = money(0);
      return;
    }

    // Se mantiene el innerHTML pero se escapan los inputs con escaparHtml
    cont.innerHTML = estado.carrito.map(function (item, i) {
      var subtotal = item.precio * item.cantidad;
      total += subtotal;
      return '' +
        '<div class="cart-item">' +
        '  <div>' +
        '    <div class="cart-item-name">' + DOMPurify.sanitize(item.nombre) + '</div>' +
        '    <div class="cart-item-meta">' + DOMPurify.sanitize(money(item.precio)) + ' c/u</div>' +
        '  </div>' +
        '  <div class="qty-control">' +
        '    <button type="button" data-acc="menos" data-i="' + i + '">&minus;</button>' +
        '    <span>' + DOMPurify.sanitize(item.cantidad) + '</span>' +
        '    <button type="button" data-acc="mas" data-i="' + i + '">+</button>' +
        '  </div>' +
        '  <div>' +
        '    <div class="cart-item-price">' + DOMPurify.sanitize(money(subtotal)) + '</div>' +
        '    <button type="button" class="link-danger" data-acc="quitar" data-i="' + i + '">Quitar</button>' +
        '  </div>' +
        '</div>';
    }).join('');

    lista.innerHTML = estado.carrito.map(function (item) {
      return '<li><span>' + DOMPurify.sanitize(raw(item.nombre)) + ' × ' + DOMPurify.sanitize(raw(item.cantidad)) + '</span><span>' +
        DOMPurify.sanitize(money(item.precio * item.cantidad)) + '</span></li>';
    }).join('');

    $('#resumen-total').textContent = money(total);
  }

  /* ---------------------------------------------------------------- pedidos */
  function enviarPedido(evento) {
    evento.preventDefault();
    var feedback = $('#pedido-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Enviando…';

    postJSON('/pedidos', {
      mesa: $('#pedido-mesa').value,
      cliente: $('#pedido-cliente').value,
      items: estado.carrito.map(function (item) {
        return { productoId: item.id, cantidad: item.cantidad };
      }),
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor se pinta con innerHTML.
        // Se usa DOMPurify para sanitizar el mensaje
        feedback.className = 'form-feedback is-error';
        feedback.textContent = DOMPurify.sanitize('No pudimos enviar el pedido: ' + (resp.data.error || 'error desconocido'));
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Pedido #' + resp.data.id + ' recibido! Total ' + money(resp.data.total) +
        '. Te atendemos en la mesa ' + resp.data.mesa + '.';
      estado.carrito = [];
      guardarCarrito();
      renderCarrito();
      $('#form-pedido').reset();
    }).catch(function () {
      feedback.className = 'form-feedback is-error';
      feedback.textContent = 'Error de conexión con el servidor.';
    });
  }

  /* --------------------------------------------------------------- reseñas */
  function cargarReseñas() {
    return api('/comentarios').then(function (resp) {
      var cont = $('#lista-resenas');
      if (!resp.ok || !resp.data.comentarios || resp.data.comentarios.length === 0) {
        cont.innerHTML = '<p class="empty">Todavía no hay reseñas. ¡Sé el primero!</p>';
        return;
      }
      // FALLA (XSS almacenado): el texto de la reseña viene de la base y se
      // inyecta con innerHTML → se ejecuta en el navegador de cada visitante.
      // Se sanitiza el texto de la reseña
      cont.innerHTML = DOMPurify.sanitize(resp.data.comentarios.map(function (c) {
        var estrellas = '';
        var i;
        for (i = 0; i < Number(c.calificacion || 0); i++) estrellas += '★';
        return '' +
          '<article class="review">' +
          '  <div class="review-head">' +
          '    <span class="review-author">' + raw(c.autor) + '</span>' +
          '    <span class="review-stars">' + estrellas + '</span>' +
          '  </div>' +
          '  <p class="review-text">' + raw(c.texto) + '</p>' +
          '</article>';
      }).join(''));
    });
  }

  function enviarReseña(evento) {
    evento.preventDefault();
    var feedback = $('#resena-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Publicando…';

    postJSON('/comentarios', {
      autor: $('#resena-autor').value,
      texto: $('#resena-texto').value,
      calificacion: Number($('#resena-calificacion').value),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        // Se mantiene el innerHTML por si el error contiene HTML Pero se sanitiza el mensaje
        feedback.innerHTML = DOMPurify.sanitize('No se pudo publicar: ' + (resp.data.error || 'error desconocido'));
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Gracias por tu reseña!';
      $('#form-resena').reset();
      cargarReseñas();
    });
  }

  /* ------------------------------------------------------------- listeners */
  function init() {
    window.__productos = {};

    // Filtros
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        estado.tipo = chip.getAttribute('data-tipo');
        cargarProductos();
      });
    });

    $('#filtro-variedad').addEventListener('change', function (e) {
      estado.variedad = e.target.value;
      cargarProductos();
    });

    var temporizador = null;
    $('#filtro-busqueda').addEventListener('input', function (e) {
      estado.q = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarProductos, 250);
    });

    // Carrito (delegación de eventos)
    $('#productos-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-agregar');
      if (!btn) return;
      agregarAlCarrito(btn.getAttribute('data-id'));
    });

    $('#carrito').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i'));
      var accion = btn.getAttribute('data-acc');
      if (accion === 'mas') cambiarCantidad(i, 1);
      else if (accion === 'menos') cambiarCantidad(i, -1);
      else if (accion === 'quitar') quitarDelCarrito(i);
    });

    $('#form-pedido').addEventListener('submit', enviarPedido);
    $('#form-resena').addEventListener('submit', enviarReseña);

    // Carga inicial
    api(urlCatalogo()).then(function (resp) {
      if (resp.ok) {
        (resp.data.productos || []).forEach(function (p) { window.__productos[p.id] = p; });
        renderProductos(resp.data.productos);
        renderResultado(resp.data.filtros, resp.data.total);
      } else {
        renderErrorProductos(resp.data.error);
      }
    });
    cargarReseñas();
    renderCarrito();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

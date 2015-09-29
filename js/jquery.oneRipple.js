// 复制图片，生成效果
// 长方形边缘反弹
+function ($) {

    var gl;

    function hasWebGLSupport() {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        var result = context && context.getExtension('OES_texture_float');
        return result;
    }

    var supportsWebGL = hasWebGLSupport();

    function createProgram(vertexSource, fragmentSource) {
        function compileSource(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
            }
            return shader;
        }

        var $id = gl.createProgram();
        gl.attachShader($id, compileSource(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader($id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram($id);
        if (!gl.getProgramParameter($id, gl.LINK_STATUS)) {
            throw new Error('link error: ' + gl.getProgramInfoLog($id));
        }

        var program = {};
        var name,match,regex,shaderCode;
        // Fetch the uniform and attribute locations
        regex = /attribute (\w+) (\w+)/g;
        shaderCode = vertexSource;
        while ((match = regex.exec(shaderCode)) != null) {
            name = match[2];
            program[name] = gl.getAttribLocation($id, name);
        }

        regex = /uniform (\w+) (\w+)/g;
        shaderCode = vertexSource + fragmentSource;
        while ((match = regex.exec(shaderCode)) != null) {
            name = match[2];
            program[name] = gl.getUniformLocation($id, name);
        }

        program.$id = $id;
        gl.useProgram($id);
        gl.enableVertexAttribArray(0);
        return program;
    }

    function bindTexture(texture, unit) {
        gl.activeTexture(gl.TEXTURE0 + (unit || 0));
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    // RIPPLES CLASS DEFINITION
    // =========================
    // 这里传进来的就是image对象了,
    var Ripples = function (el, options) {
        var that = this;

        this.el = el;
        this.$el = $(el);

        // 只支持img

        this.perturbance = options.perturbance;
        this.dropRadius = options.dropRadius;
        this.speed = options.speed;

        var canvas = document.createElement('canvas');
        canvas.width = el.naturalWidth;
        canvas.height = el.naturalHeight;

        this.width = Math.ceil(canvas.width / this.speed * 60);
        this.height = Math.ceil(canvas.height / this.speed * 60);

        this.delta = new Float32Array([1/this.width,1/this.height]);
        this.canvas = canvas;
        this.$canvas = $(canvas);
        this.$el.after(canvas);
        this.$el.hide();
        this.context = gl = canvas.getContext('webgl',{alpha:false}) || canvas.getContext('experimental-webgl',{alpha:false});

        // Load extensions
        gl.getExtension('OES_texture_float');
        var linearSupport = gl.getExtension('OES_texture_float_linear')

        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);

        that.backgroundTexture = texture;

        this.$canvas.on({
            mousemove:function(e){
                if (that.alive && that.running) that.dropAtMouse(e, that.dropRadius, 0.01);
            },
            mousedown:function(e){
                if (that.alive && that.running) that.dropAtMouse(e, that.dropRadius * 1.5, 0.14);
            }
        });

        this.canvas.addEventListener('touchstart', function(e){
            if (that.alive && that.running) that.dropAtMouse(e.touches[0], that.dropRadius * 1.5, 0.14);
        });

        this.canvas.addEventListener('touchmove', function(e){
            if (that.alive && that.running) that.dropAtMouse(e.touches[0], that.dropRadius, 0.01);
        });

        this.textures = [];
        this.framebuffers = [];

        for (var i = 0; i < 2; i++) {
            var texture = gl.createTexture();
            var framebuffer = gl.createFramebuffer();

            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            framebuffer.width = this.width;
            framebuffer.height = this.height;

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linearSupport ? gl.LINEAR : gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);

            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
                throw new Error('Rendering to this texture is not supported (incomplete framebuffer)');
            }

            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            this.textures.push(texture);
            this.framebuffers.push(framebuffer);
        }



        // Init GL stuff
        this.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            +1, -1,
            +1, +1,
            -1, +1
        ]), gl.STATIC_DRAW);

        this.initShaders();

        this.running = true;
        this.alive = true;

        // Init animation
        function step() {
            that.step();
            if(that.alive){
                requestAnimationFrame(step);
            }
        }

        requestAnimationFrame(step);
    };

    Ripples.DEFAULTS = {
        dropRadius: 10,
        perturbance: 0.03,
        speed:120,
    };

    Ripples.prototype = {

        step: function() {
            gl = this.context;

            if (!this.alive || !this.backgroundTexture) return;

            if (this.running) {
                this.update();
            }

            this.render();
        },

        drawQuad: function() {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        },

        render: function() {
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            gl.useProgram(this.renderProgram.$id);

            bindTexture(this.backgroundTexture, 0);
            bindTexture(this.textures[0], 1);

            gl.uniform1i(this.renderProgram.samplerBackground, 0);
            gl.uniform1i(this.renderProgram.samplerRipples, 1);

            this.drawQuad();
        },

        update: function() {
            gl.viewport(0, 0, this.width, this.height);

            for (var i = 0; i < 2; i++) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
                bindTexture(this.textures[1-i]);
                gl.useProgram(this.updateProgram[i].$id);

                this.drawQuad();
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        },

        initShaders: function() {
            var vertexShader = [
                'attribute vec2 vertex;',
                'varying vec2 coord;',
                'void main() {',
                'coord = vertex * 0.5 + 0.5;',
                'gl_Position = vec4(vertex, 0.0, 1.0);',
                '}'
            ].join('\n');

            this.dropProgram = createProgram(vertexShader, [
                'precision highp float;',

                'const float PI = 3.141592653589793;',
                'uniform sampler2D texture;',
                'uniform vec2 center;',
                'uniform vec2 usize;',
                'uniform float radius;',
                'uniform float strength;',

                'varying vec2 coord;',

                'void main() {',
                'vec4 info = texture2D(texture, coord);',

                'float drop = max(0.0, 1.0 - length(center - coord*usize) / radius);',
                'drop = 0.5 - cos(drop * PI) * 0.5;',

                'info.r += drop * strength;',

                'gl_FragColor = info;',
                '}'
            ].join('\n'));

            this.updateProgram = [0,0];
            this.updateProgram[0] = createProgram(vertexShader, [
                'precision highp float;',

                'uniform sampler2D texture;',
                'uniform vec2 delta;',

                'varying vec2 coord;',

                'void main() {',
                'vec4 info = texture2D(texture, coord);',

                'vec2 dx = vec2(delta.x, 0.0);',
                'vec2 dy = vec2(0.0, delta.y);',

                'float average = (',
                'texture2D(texture, coord - dx).r +',
                'texture2D(texture, coord - dy).r +',
                'texture2D(texture, coord + dx).r +',
                'texture2D(texture, coord + dy).r',
                ') * 0.25;',

                'info.g += (average - info.r) * 2.0;',
                'info.g *= 0.995;',
                'info.r += info.g;',

                'gl_FragColor = info;',
                '}'
            ].join('\n'));
            gl.uniform2fv(this.updateProgram[0].delta, this.delta);

            this.updateProgram[1] = createProgram(vertexShader, [
                'precision highp float;',

                'uniform sampler2D texture;',
                'uniform vec2 delta;',

                'varying vec2 coord;',

                'void main() {',
                'vec4 info = texture2D(texture, coord);',

                'vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);',
                'vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);',
                'info.ba = normalize(cross(dy, dx)).xz;',

                'gl_FragColor = info;',
                '}'
            ].join('\n'));
            gl.uniform2fv(this.updateProgram[1].delta, this.delta);

            this.renderProgram = createProgram([
                'precision highp float;',

                'attribute vec2 vertex;',
                'varying vec2 ripplesCoord;',
                'varying vec2 backgroundCoord;',
                'void main() {',
                'backgroundCoord = vertex * 0.5 + 0.5;',
                'backgroundCoord.y = 1.0 - backgroundCoord.y;',
                'ripplesCoord = vec2(vertex.x, -vertex.y) * 0.5 + 0.5;',
                'gl_Position = vec4(vertex.x, -vertex.y, 0.0, 1.0);',
                '}'
            ].join('\n'), [
                'precision highp float;',

                'uniform sampler2D samplerBackground;',
                'uniform sampler2D samplerRipples;',
                'uniform float perturbance;',
                'varying vec2 ripplesCoord;',
                'varying vec2 backgroundCoord;',

                'void main() {',
                'vec2 offset = -texture2D(samplerRipples, ripplesCoord).ba;',
                'float specular = pow(max(0.0, dot(offset, normalize(vec2(-0.6, 1.0)))), 4.0);',
                'gl_FragColor = texture2D(samplerBackground, backgroundCoord + offset * perturbance) + specular;',
                '}'
            ].join('\n'));
            gl.uniform1f(this.renderProgram.perturbance, this.perturbance);
        },

        dropAtMouse: function(e, radius, strength) {
            this.drop(
                e.pageX - this.$canvas.offset().left,
                e.pageY - this.$canvas.offset().top,
                radius,
                strength
            );
        },

        drop: function(x, y, radius, strength) {
            var that = this;

            gl = this.context;

            var elWidth = this.$canvas.outerWidth();
            var elHeight = this.$canvas.outerHeight();

            var usize = new Float32Array([elWidth,elHeight]);

            var dropPosition = new Float32Array([x,elHeight-y]);

            gl.viewport(0, 0, this.width, this.height);

            // Render onto texture/framebuffer 0
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[0]);

            // Using texture 1
            bindTexture(this.textures[1]);

            gl.useProgram(this.dropProgram.$id);
            gl.uniform2fv(this.dropProgram.center, dropPosition);
            gl.uniform2fv(this.dropProgram.usize, usize);
            gl.uniform1f(this.dropProgram.radius, radius);
            gl.uniform1f(this.dropProgram.strength, strength);

            this.drawQuad();

            // Switch textures
            var t = this.framebuffers[0]; this.framebuffers[0] = this.framebuffers[1]; this.framebuffers[1] = t;
            t = this.textures[0]; this.textures[0] = this.textures[1]; this.textures[1] = t;

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        },

        pause: function() {
            this.running = false;
        },

        play: function() {
            this.running = true;
        },

        end: function() {
            this.alive = false;
            this.canvas.remove();
            this.$el.show();
            this.$el.removeData("one-ripple");
        }
    };

    // RIPPLES PLUGIN DEFINITION
    // ==========================

    var old = $.fn.oneRipple;

    $.fn.oneRipple = function(option) {
        if (!supportsWebGL) throw new Error('Your browser does not support WebGL or the OES_texture_float extension.');

        var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : undefined;


        return this.filter("img").each(function() {
            var $this   = $(this);
            function work(){
                var data    = $this.data('one-ripple');
                var options = $.extend({}, Ripples.DEFAULTS, $this.data(), typeof option == 'object' && option);

                if (!data && typeof option == 'string') return;
                if (!data) $this.data('one-ripple', (data = new Ripples($this[0], options)));
                else if (typeof option == 'string'){
                    if (Ripples.prototype[option]){
                        Ripples.prototype[option].apply(data, args);
                    }else{
                        console.error("oneRipple func name not valid : "+option);
                    }
                }
            }
            if (this.complete){
                work();
            }else{
                this.onload = work;
            }
        });
    }

    $.fn.oneRipple.Constructor = Ripples;


    // RIPPLES NO CONFLICT
    // ====================

    $.fn.oneRipple.noConflict = function() {
        $.fn.oneRipple = old;
        return this;
    }

}(window.jQuery);

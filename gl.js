var gl = null;
+function() {
    var canvas = document.getElementById("gl_view");
    gl = canvas.getContext("webgl",{alpha:false});
    var image = document.getElementById("vocaloid");
    webgl = gl;
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    webgl.blendEquation(webgl.FUNC_ADD);
    gl.enable(gl.BLEND);
}();
var webgl = gl;
function myresize(){
    var canvas = document.getElementById("gl_view");
    var image = document.getElementById("vocaloid");
    canvas.width = image.clientWidth;
    canvas.height = image.clientHeight;
    $(canvas).css({
        width:image.clientWidth,
        height:image.clientHeight
    })
    console.log("ok");
    gl.viewport(0, 0, canvas.width, canvas.height);
}

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

    var program = {};

    program.id = gl.createProgram();
    gl.attachShader(program.id, compileSource(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program.id, compileSource(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program.id);
    if (!gl.getProgramParameter(program.id, gl.LINK_STATUS)) {
        throw new Error('link error: ' + gl.getProgramInfoLog(program.id));
    }
    gl.useProgram(program.id);

    // Fetch the uniform and attribute locations
    program.uniforms = {};
    program.attributes = {};

    regex = /attribute (\w+) (\w+)/g;
    shaderCode = vertexSource;
    while ((match = regex.exec(shaderCode)) != null) {
        name = match[2];
        program.attributes[name] = gl.getAttribLocation(program.id, name);
    }

    var name,match,regex,shaderCode;
    regex = /uniform (\w+) (\w+)/g;
    shaderCode = vertexSource + fragmentSource;
    while ((match = regex.exec(shaderCode)) != null) {
        name = match[2];
        program.uniforms[name] = gl.getUniformLocation(program.id, name);
    }


    return program;
}

function createProgramWithTemplate(name) {
    var _func = arguments.callee;
    _func._cache = _func._cache || {};
    if (_func._cache[name]) {
        gl.useProgram(_func._cache[name].id);
        return;
    }
    var dom = document.getElementById(name);
    if (!dom) {
        throw new Error("createProgramWithTemplate 参数有误")
    }
    var vsh = $(dom).find(".vsh").html();
    var fsh = $(dom).find(".fsh").html();
    _func._cache[name] =  createProgram(vsh, fsh);
    return _func._cache[name];
}

function renderWithTemplate(vertices, name) {
    createProgramWithTemplate(name);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    //gl.clearColor(1.0, 0.0, 0.0, 1.0);
    //gl.clear(gl.COLOR_BUFFER_BIT);

    gl.finish();
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
    //gl.disable(gl.BLEND);
    gl.finish();
}

function createTextureByImage(image) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    return texture;
}

function bindTexture(texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + (unit || 0));
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

function createTextureByImgID(imgID){
    var imgObj = document.getElementById(imgID);
    if(imgObj == null) {
        throw new Error("createTextureByImgID 找不到图片");
    }
    return createTextureByImage(imgObj);
}

function getScriptTextByID(id){
    var txt = $("#"+id).html();
    if(txt){
        return txt;
    }else{
        throw new Error("getScriptTextByID");
    }
}


function drawImage(){
    if(!drawImage.quad){
        drawImage.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, drawImage.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            +1, -1,
            +1, +1,
            -1, +1
        ]), gl.STATIC_DRAW);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, drawImage.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    //gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.flush();
}

function bindImage(program){
    var texObj = createTextureByImgID("vocaloid");
    bindTexture(texObj);
    gl.uniform1i(program.uniforms.inputImageTexture, 0);
}

//直接绘制原图：
function renderOrigin(){
    // 读者可选择自己喜欢的加载方式，本教程为了方便，
    // 选择html标签方式加载shader代码。
    var vsh = getScriptTextByID("img_vsh");
    var fsh = getScriptTextByID("img_fsh_origin");
    //不能直接使用但是renderWebGL 这个函数，我们先抄下它的前几句。
    var program = createProgram(vsh, fsh)
    bindImage(program);

    drawImage();
}

//绘制反色：
function renderInverse(){
    // 读者可选择自己喜欢的加载方式，本教程为了方便，
    // 选择html标签方式加载shader代码。
    var vsh = getScriptTextByID("img_vsh");
    var fsh = getScriptTextByID("img_fsh_inverse");
    //不能直接使用但是renderWebGL 这个函数，我们先抄下它的前几句。

    bindImage(createProgram(vsh, fsh));

    drawImage();
}

//绘制浮雕：
function renderEmboss(){
    // 读者可选择自己喜欢的加载方式，本教程为了方便，
    // 选择html标签方式加载shader代码。
    var vsh = getScriptTextByID("img_vsh");
    var fsh = getScriptTextByID("img_fsh_emboss");
    //不能直接使用但是renderWebGL 这个函数，我们先抄下它的前几句。
    var programObject ;
    bindImage(programObject = createProgram(vsh, fsh));
    //由于浮雕效果需要知道采样步长，所以传递此参数给shader。

    var cvsObj = document.getElementById("gl_view");
    webgl.uniform2f(programObject.uniforms.steps, 1.0 / cvsObj.width, 1.0 / cvsObj.height);
    drawImage();
}

//绘制边缘：
function renderEdge(){
    // 读者可选择自己喜欢的加载方式，本教程为了方便，
    // 选择html标签方式加载shader代码。
    var vsh = getScriptTextByID("img_vsh");
    var fsh = getScriptTextByID("img_fsh_edge");
    //不能直接使用但是renderWebGL 这个函数，我们先抄下它的前几句。
    var programObject ;
    bindImage(programObject = createProgram(vsh, fsh));
    //由于边缘效果需要知道采样步长，所以传递此参数给shader。

    var cvsObj = document.getElementById("gl_view");
    webgl.uniform2f(programObject.uniforms.steps, 1.0 / cvsObj.width, 1.0 / cvsObj.height);
    drawImage();
}

//波纹效果需要重绘，这里预留一个interval。
var itv = {};

//重绘wave
function redrawWave() {
    webgl.uniform1f(itv.uniformMotion, itv.motion += 0.05);
    webgl.uniform1f(itv.uniformAngle, 15.0);
    drawImage();
    if (itv.motion > 1.0e20) itv.motion = 0.0;
}

//绘制波纹：
function renderWave(){
    // 读者可选择自己喜欢的加载方式，本教程为了方便，
    // 选择html标签方式加载shader代码。
    var vsh = getScriptTextByID("img_vsh");
    var fsh = getScriptTextByID("img_fsh_wave");

    var programObject ;
    bindImage(programObject = createProgram(vsh, fsh));

    //wave效果需要使用motion和angle两个参数。
    itv.uniformMotion = programObject.uniforms["motion"];
    itv.uniformAngle = programObject.uniforms["angle"];
    itv.motion = 0.0;
    itv.interval = setInterval("redrawWave()", 15);
}

function stopWave(){
    if(itv.interval){
        clearInterval(itv.interval);
        itv.interval = null;
    }
}
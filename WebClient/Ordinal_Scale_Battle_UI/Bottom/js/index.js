var settings = { 
    ip: "local",
    port: 5050,
    start: 0,
    end: 64,
	channel: 2
};

adv = new ADV_Plugin(settings.ip, settings.port);

var peakValue = 10;
var dataDL = settings.end - settings.start;
var dataLen = dataDL * settings.channel;

audioData = new Array(dataDL*settings.channel);
animeData = new Array(dataDL*settings.channel);

// 初始化
for (var i = 0; i < audioData.length; i++) {
    audioData[i] = animeData[i] = 0;
}


adv.ondata = function(data){ 
	//数据归一化
    var max = 0;
    for(var j=0;j<settings.channel;j++) {
        for(var i=j*64+settings.start; i<j*64+settings.end; i++) {
            if(data[i] > max) 
                max = data[i];
        }
    }

    if (max != 0) {
    	peakValue = peakValue * 0.99 + max * 0.01;
    }

    for(var j=0; j<settings.channel; j++) {
        for(var i=0; i<dataDL; i++) {
            audioData[i+j*dataDL] = data[settings.start+i+j*64] / peakValue;
        }
    }
};

function SAOWave(opt) {
	this.opt = opt || {};

	this.K = 4.5;
	this.F = 12;

	this.speed = this.opt.speed || 0.1;
	this.noise = this.opt.noise || 0;
	this.phase = this.opt.phase || 0;

	this.trebleAm = this.opt.trebleAm || 0;
	this.altoAm = this.opt.altoAm || 0;
	this.bassAm = this.opt.bassAm || 0;

	this.treblePhase = this.opt.treblePhase || 0;
	this.altoPhase = this.opt.altoPhase || 0;
	this.bassPhase = this.opt.bassPhase || 0;

	this.bassRatio = 0.1;
	this.altoRatio = 0.3;
	this.trebleRatio = (1 - this.bassRatio - this.altoRatio);

	this.canvas = this.opt.canvas || document.createElement('canvas');

	if (!devicePixelRatio) devicePixelRatio = 1;
	this.width = window.innerWidth;
	this.height = window.innerHeight;
	this.MAX = (this.height/2)-4;

	this.canvas.width = this.width;
	this.canvas.height = this.height;
	this.canvas.style.width = (this.width/devicePixelRatio)+'px';
	this.canvas.style.height = (this.height/devicePixelRatio)+'px';
	(this.opt.container || document.body).appendChild(this.canvas);
	this.ctx = this.canvas.getContext('2d');

	this.run = false;

	this.fps = 50;
	this.now = Date.now();;
	this.then = Date.now();
	this.interval = 1000/this.fps;
	this.delta = 0;
}

SAOWave.prototype = {
	_globalAttenuationFn: function(x){
		return Math.pow(this.K*4/(this.K*4+Math.pow(x,4)),this.K*2);
	},

	_drawLine: function(noise, color, width, phase){
		this.ctx.moveTo(0,0);
		this.ctx.beginPath();
		this.ctx.strokeStyle = color;
		this.ctx.lineWidth = width || 1;
		var x, y;
		for (var i=-this.K; i<=this.K; i+=0.01) {
			x = this.width*((i+this.K)/(this.K*2));
			y = this.height/2 + (this.noise + noise) * this._globalAttenuationFn(i) * Math.sin(this.F*i-phase);
            this.ctx.transform(1, (i-this.K)*0.09/(2*this.K), 0, 1, 0, 0);
			this.ctx.lineTo(x, y);
			this.ctx.resetTransform();
		}
		this.ctx.stroke();
	},

	_clear: function(){
		this.ctx.globalCompositeOperation = 'destination-out';
		this.ctx.fillRect(0, 0, this.width, this.height);
		this.ctx.globalCompositeOperation = 'source-over';
	},

	_draw: function(){
		if (!this.run) return;

		this.trebleAm = 0;
		this.altoAm = 0;
		this.bassAm = 0;
		this.treblePhase = 0;
		this.altoPhase = 0;
		this.bassPhase = 0;

		for (var j=0; j<settings.channel;j++) {
			for (var i=0; i<dataDL;i++) {
				animeData[i+j*dataDL] += (audioData[i+j*dataDL] - animeData[i+j*dataDL]) * 0.3
            	animeData[i+j*dataDL] = Math.min(animeData[i+j*dataDL], 1);
				if(i<dataDL*this.bassRatio) {
					this.bassAm += animeData[i+j*dataDL];
					if (settings.channel==2) {
						this.bassPhase += (animeData[i]-animeData[i+dataDL]);
					} else {
						this.bassPhase = 0;
					}
				} else if (i<dataDL*this.altoRatio) {
					this.altoAm += animeData[i+j*dataDL];
					if (settings.channel==2) {
						this.altoPhase += (animeData[i]-animeData[i+dataDL]);
					} else {
						this.altoPhase = 0;
					}
				} else {
					this.trebleAm += animeData[i+j*dataDL];
					if (settings.channel==2) {
						this.treblePhase += (animeData[i]-animeData[i+dataDL]);
					} else {
						this.treblePhase = 0;
					}
				}
			}
		}

        this.trebleAm = this.trebleAm / (dataLen*this.trebleRatio);
		this.altoAm = this.altoAm / (dataLen*this.altoRatio);
		this.bassAm = this.bassAm / (dataLen*this.bassRatio);
		this.treblePhase = this.treblePhase / (dataLen*this.trebleRatio);
		this.altoPhase = this.altoPhase / (dataLen*this.altoRatio);
		this.bassPhase = this.bassPhase / (dataLen*this.bassRatio);

		this.phase = (this.phase+this.speed)%(Math.PI*64);
		this._clear();
		this._drawLine((this.MAX-this.noise)*5*this.trebleAm, 'rgba(65,105,225,1)', 1.5, this.phase+this.treblePhase);
		this._drawLine((this.MAX-this.noise)*0.8*this.bassAm, 'rgba(220,20,60,1)', 1.5, this.phase+this.bassPhase+0.8);
		this._drawLine((this.MAX-this.noise)*2*this.altoAm, 'rgba(248,248,255,1)', 2, this.phase+this.altoPhase+0.4);
	},

	tick: function() {
	　　requestAnimationFrame(this.tick.bind(this));
	　　this.now = Date.now();
	　　this.delta = this.now - this.then;
	　　if (this.delta > this.interval) {
	　　　　// 这里不能简单then=now，否则还会出现上边简单做法的细微时间差问题。例如fps=10，每帧100ms，而现在每16ms（60fps）执行一次draw。16*7=112>100，需要7次才实际绘制一次。这个情况下，实际10帧需要112*10=1120ms>1000ms才绘制完成。
	　　　　this.then = this.now - (this.delta % this.interval);
	　　　　this._draw(); // ... Code for Drawing the Frame ...
	　　}
	},

	start: function(){
		this.phase = 0;
		this.run = true;
		this.tick();
	},

	stop: function(){
		this.run = false;
		this._clear();
	},

	setNoise: function(v){
		this.noise = Math.min(v, 1)*this.MAX;
	},

	setSpeed: function(v){
		this.speed = v;
	},

	set: function(noise, speed) {
		this.setNoise(noise);
		this.setSpeed(speed);
	}
};




var SW = new SAOWave({});
SW.setSpeed(0.2);
SW.setNoise(0.15);
SW.start();

window.onresize = function () {  
    SW.width = window.innerWidth;  
    SW.height = window.innerHeight;
    SW.MAX = (SW.height/2)-4;

    document.getElementsByTagName("body")[0].style.height = SW.width+"px";
    document.getElementsByTagName("body")[0].style.width  = SW.height+"px";

	SW.canvas.width = SW.width;
	SW.canvas.height = SW.height;
	SW.canvas.style.width = (SW.width/devicePixelRatio)+'px';
	SW.canvas.style.height = (SW.height/devicePixelRatio)+'px';
};  
window.onresize();

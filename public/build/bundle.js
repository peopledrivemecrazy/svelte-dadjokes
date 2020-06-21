
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.23.2 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let p0;
    	let t0;
    	let t1;
    	let p1;
    	let t3;
    	let p2;
    	let t5;
    	let p3;
    	let t6;
    	let t7;
    	let h30;
    	let t9;
    	let h31;
    	let t10;
    	let svg;
    	let path0;
    	let path1;
    	let path2;
    	let t11;
    	let button;
    	let t13;
    	let footer;
    	let t14;
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			p0 = element("p");
    			t0 = text(/*setup*/ ctx[0]);
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "..";
    			t3 = space();
    			p2 = element("p");
    			p2.textContent = "....";
    			t5 = space();
    			p3 = element("p");
    			t6 = text(/*punchline*/ ctx[1]);
    			t7 = space();
    			h30 = element("h3");
    			h30.textContent = "Press Enter/Space for a new joke!";
    			t9 = space();
    			h31 = element("h3");
    			t10 = text("👨 Jokes with\n\t\t\t");
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			t11 = space();
    			button = element("button");
    			button.textContent = "Get me one more!";
    			t13 = space();
    			footer = element("footer");
    			t14 = text("from ");
    			a = element("a");
    			a.textContent = "Anoram";
    			attr_dev(p0, "class", "svelte-1bg3mov");
    			add_location(p0, file, 32, 2, 560);
    			attr_dev(p1, "class", "svelte-1bg3mov");
    			add_location(p1, file, 33, 2, 577);
    			attr_dev(p2, "class", "svelte-1bg3mov");
    			add_location(p2, file, 34, 2, 589);
    			attr_dev(p3, "class", "svelte-1bg3mov");
    			add_location(p3, file, 35, 2, 603);
    			attr_dev(h30, "class", "hidden-xs svelte-1bg3mov");
    			add_location(h30, file, 36, 2, 624);
    			attr_dev(path0, "id", "logotype");
    			attr_dev(path0, "fill", "#4a4a55");
    			attr_dev(path0, "d", "M172.39,100.41a24.1,24.1,0,0,1-13.72-3.87,19.86,19.86,0,0,1-8-10.61L159,82.86a15.4,15.4,0,0,0,5.45,6.6,14.37,14.37,0,0,0,8.27,2.43,12.14,12.14,0,0,0,7.88-2.38,8.29,8.29,0,0,0,2.94-6.82,7.43,7.43,0,0,0-.81-3.45,10.32,10.32,0,0,0-1.83-2.6,12.36,12.36,0,0,0-3.16-2.09c-1.42-.71-2.59-1.25-3.53-1.62s-2.32-.87-4.13-1.49c-2.28-.8-4-1.42-5.12-1.88a37.86,37.86,0,0,1-4.47-2.25,16.37,16.37,0,0,1-4.18-3.16A15.43,15.43,0,0,1,153.81,60a14.77,14.77,0,0,1,4-16.79q5.12-4.51,13.89-4.51,7.34,0,12.06,3.23a15.63,15.63,0,0,1,6.35,8.61l-8.18,2.73a9.57,9.57,0,0,0-4-4.39A13.3,13.3,0,0,0,171,47.24a10.7,10.7,0,0,0-6.69,1.87,6.28,6.28,0,0,0-2.42,5.29,5.52,5.52,0,0,0,1.87,4.09,13,13,0,0,0,3.92,2.64c1.36.57,3.44,1.33,6.22,2.3,1.7.63,3,1.09,3.79,1.41s2,.83,3.62,1.57a25.79,25.79,0,0,1,3.67,2,34.36,34.36,0,0,1,3,2.43,12.86,12.86,0,0,1,2.6,3.11,17.06,17.06,0,0,1,1.53,3.84,17.42,17.42,0,0,1,.64,4.81q0,8.36-5.71,13.08T172.39,100.41Zm54.62-1L206.56,39.74h9.54l13.55,41.58a66.19,66.19,0,0,1,1.88,6.82,63.43,63.43,0,0,1,1.87-6.82l13.38-41.58h9.46L235.87,99.39Zm47.29,0V39.74h37v8.35H283.17V64.45h18.15V72.8H283.17V91h30v8.35Zm61.44,0V39.74h8.87V90.87h29.14v8.52Zm71.41-51.13V99.39h-8.86V48.26H381.42V39.74H424v8.52Zm35.2,51.13V39.74h37v8.35H451.21V64.45h18.15V72.8H451.21V91h30v8.35Z");
    			add_location(path0, file, 40, 4, 826);
    			attr_dev(path1, "id", "back");
    			attr_dev(path1, "fill", "#ff3e00");
    			attr_dev(path1, "d", "M110.23,28.39C99.83,13.51,79.29,9.1,64.44,18.56L38.36,35.18a29.9,29.9,0,0,0-13.52,20,31.53,31.53,0,0,0,3.1,20.24,29.94,29.94,0,0,0-4.47,11.18,31.86,31.86,0,0,0,5.45,24.12c10.4,14.88,30.94,19.29,45.79,9.83L100.79,104a30,30,0,0,0,13.52-20,31.52,31.52,0,0,0-3.11-20.23,30.13,30.13,0,0,0,4.48-11.18,31.9,31.9,0,0,0-5.45-24.12");
    			add_location(path1, file, 42, 4, 2135);
    			attr_dev(path2, "id", "front");
    			attr_dev(path2, "fill", "#fff");
    			attr_dev(path2, "d", "M61.89,112.16a20.73,20.73,0,0,1-22.24-8.25,19.14,19.14,0,0,1-3.27-14.5A17,17,0,0,1,37,87l.49-1.5,1.34,1A33.78,33.78,0,0,0,49,91.56l1,.29-.09,1A5.9,5.9,0,0,0,51,96.7a6.25,6.25,0,0,0,6.7,2.48,5.85,5.85,0,0,0,1.6-.7L85.34,81.86a5.42,5.42,0,0,0,2.45-3.64,5.77,5.77,0,0,0-1-4.37,6.25,6.25,0,0,0-6.7-2.48,5.72,5.72,0,0,0-1.6.7l-10,6.35a19.1,19.1,0,0,1-5.29,2.32A20.72,20.72,0,0,1,41,72.5,19.16,19.16,0,0,1,37.75,58a18,18,0,0,1,8.13-12.06L72,29.32A19.05,19.05,0,0,1,77.26,27a20.71,20.71,0,0,1,22.23,8.25,19.14,19.14,0,0,1,3.28,14.5,20.15,20.15,0,0,1-.62,2.43l-.5,1.5-1.33-1a33.78,33.78,0,0,0-10.2-5.1l-1-.29.09-1a5.86,5.86,0,0,0-1.06-3.88A6.23,6.23,0,0,0,81.49,40a5.72,5.72,0,0,0-1.6.7L53.8,57.29a5.45,5.45,0,0,0-2.45,3.63,5.84,5.84,0,0,0,1,4.38A6.25,6.25,0,0,0,59,67.78a6,6,0,0,0,1.6-.7l10-6.34a18.61,18.61,0,0,1,5.3-2.33,20.7,20.7,0,0,1,22.23,8.24,19.16,19.16,0,0,1,3.28,14.5,18,18,0,0,1-8.13,12.06L67.19,109.83a19.18,19.18,0,0,1-5.3,2.33");
    			add_location(path2, file, 44, 4, 2504);
    			attr_dev(svg, "id", "svelte");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "300");
    			attr_dev(svg, "height", "139");
    			attr_dev(svg, "viewBox", "0 0 519 139");
    			add_location(svg, file, 39, 3, 722);
    			attr_dev(h31, "class", "sign svelte-1bg3mov");
    			add_location(h31, file, 38, 2, 688);
    			add_location(button, file, 49, 2, 3500);
    			attr_dev(div, "class", "text-center svelte-1bg3mov");
    			add_location(div, file, 30, 1, 531);
    			attr_dev(main, "class", "svelte-1bg3mov");
    			add_location(main, file, 28, 0, 522);
    			attr_dev(a, "href", "https://anoram.com");
    			add_location(a, file, 56, 6, 3609);
    			attr_dev(footer, "class", "text-center svelte-1bg3mov");
    			add_location(footer, file, 55, 0, 3574);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, p1);
    			append_dev(div, t3);
    			append_dev(div, p2);
    			append_dev(div, t5);
    			append_dev(div, p3);
    			append_dev(p3, t6);
    			append_dev(div, t7);
    			append_dev(div, h30);
    			append_dev(div, t9);
    			append_dev(div, h31);
    			append_dev(h31, t10);
    			append_dev(h31, svg);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(div, t11);
    			append_dev(div, button);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, footer, anchor);
    			append_dev(footer, t14);
    			append_dev(footer, a);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*handleKeydown*/ ctx[3], false, false, false),
    					listen_dev(button, "click", /*fetchJoke*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*setup*/ 1) set_data_dev(t0, /*setup*/ ctx[0]);
    			if (dirty & /*punchline*/ 2) set_data_dev(t6, /*punchline*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(footer);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const url = "https://us-central1-dadsofunny.cloudfunctions.net/DadJokes/random/jokes";

    function instance($$self, $$props, $$invalidate) {
    	let result;
    	let setup = "...";
    	let punchline = "...";

    	async function fetchJoke() {
    		const response = await fetch(url);
    		result = await response.json();
    		$$invalidate(0, setup = result.setup);
    		$$invalidate(1, punchline = result.punchline);
    	}

    	let keyCode;

    	function handleKeydown(event) {
    		keyCode = event.keyCode;

    		if (keyCode == 13 || keyCode == 32) {
    			fetchJoke();
    		}
    	}

    	fetchJoke();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	$$self.$capture_state = () => ({
    		url,
    		result,
    		setup,
    		punchline,
    		fetchJoke,
    		keyCode,
    		handleKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ("result" in $$props) result = $$props.result;
    		if ("setup" in $$props) $$invalidate(0, setup = $$props.setup);
    		if ("punchline" in $$props) $$invalidate(1, punchline = $$props.punchline);
    		if ("keyCode" in $$props) keyCode = $$props.keyCode;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [setup, punchline, fetchJoke, handleKeydown];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

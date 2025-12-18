import template from 'just-template';

class PageIncludeTransform {
  origin: string;
  env: Env;
  page: string;
  before: boolean;

  constructor(e: Env, o: string, page: string, before: boolean=true) {
    this.env = e;
    this.origin = o;
    this.page = page;
    this.before = before;
  }
  async element(el: Element) {
    let response = await this.env.ASSETS.fetch(new Request(this.origin + `/transforms/${this.page}`), {
      cf: {
        cacheTtl: 90,
        cacheEverything: true,
      }
    });
    if (response.ok) {
      if (this.before)
        el.prepend(await response.text(), {html: true});
      else
        el.append(await response.text(), {html: true});
    }
  }
}

export class HTMLTransformFooter extends PageIncludeTransform {
  constructor(e: Env, o: string) {
    super(e, o, "footer.html");
  }
}

export class HTMLTransformHeader extends PageIncludeTransform {
  constructor(e: Env, o: string) {
    super(e, o, "header.html", false);
  }
}

export class HTMLTransformBody extends PageIncludeTransform {
  constructor(e: Env, o: string) {
    super(e, o, "content.html");
  }
}

export class TextReplacer {
  totalText: string;
  replaceObj: any;
  constructor(findReplaceObj: any) {
    this.totalText = "";
    this.replaceObj = findReplaceObj;
  }
  // Helper function
  hasKey = (str:string) => { 
    return Object.keys(this.replaceObj).find(v => str.includes(v)) != undefined;
  }

  modifyText(tx: Text): Text {
    if (tx.lastInTextNode == true) {
      if (this.hasKey(this.totalText)) {
        this.totalText = template(this.totalText, this.replaceObj);
        tx.replace(this.totalText);
      }
    } else {
      this.totalText += tx.text;
      if (this.hasKey(tx.text))
        tx.remove();
    }
    return tx;
  }

  text(tx: Text) {
    this.modifyText(tx);
  }
  element(el: Element) {
    for (const val of el.attributes) {
      if (this.hasKey(val[1])) {
        el.setAttribute(val[0], template(val[1], this.replaceObj));
      }
    }
  }
}

export class TitleUpdater extends TextReplacer {
  constructor(e: Env) {
    const obj = {
      TITLE: e.SITE_TITLE
    };
    super(obj);
  }
}

export class ManifestUpdater extends TextReplacer {
  constructor(e: Env) {
    const obj = {
      TITLE: e.SITE_TITLE,
      SHORTNAME: e.SITE_SHORTNAME
    }
    super(obj);
  }
}

export class MetaUpdater extends TextReplacer {
  constructor(e: Env, origin: string) {
    const obj = {
      TITLE: e.SITE_TITLE,
      DESC: e.SITE_DESCRIPTION,
      HOST: origin
    };
    super(obj);
  }
}

export function createBaseRewriter(env: Env, origin: string) {
  return new HTMLRewriter()
    .on('head', new HTMLTransformHeader(env, origin))
    .on('footer', new HTMLTransformFooter(env, origin))
    .on('div.bodyContent', new HTMLTransformBody(env, origin))
    .on('title', new TitleUpdater(env))
    .on('meta', new MetaUpdater(env, origin))
    .on('header h1', new TitleUpdater(env));
}